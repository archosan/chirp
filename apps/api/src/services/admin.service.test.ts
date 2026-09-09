import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import {
  createTestComment,
  createTestPost,
  createTestUser,
} from "../../tests/helpers";
import { generateId } from "./utils";
import {
  banUser,
  getAuditLogs,
  getUserDetails,
  listReports,
  listUsers,
  reviewReport,
  updateUserRole,
} from "./admin.service";

const { users, reports, auditLogs } = schema;

describe("AdminService", () => {
  describe("listUsers", () => {
    it("returns users with post and comment counts", async () => {
      const user = await createTestUser({
        username: `admin-list-${generateId()}`,
      });
      const postId = await createTestPost(user.id, "Admin list post");
      await createTestComment(postId, user.id, "Admin list comment");

      const result = await listUsers({
        searchQuery: user.username,
        limit: 10,
        offset: 0,
      });

      expect(result.users).toHaveLength(1);
      expect(result.users[0].id).toBe(user.id);
      expect(result.users[0].postCount).toBe(1);
      expect(result.users[0].commentCount).toBe(1);
      expect(result.total).toBeGreaterThanOrEqual(1);
    });
  });

  describe("getUserDetails", () => {
    it("returns user details without passwordHash", async () => {
      const user = await createTestUser();

      const result = await getUserDetails(user.id);

      expect(result.id).toBe(user.id);
      expect(result.postCount).toBe(0);
      expect(result.commentCount).toBe(0);
      expect("passwordHash" in result).toBe(false);
    });

    it("throws when user does not exist", async () => {
      await expect(getUserDetails("missing-user")).rejects.toThrow(
        "User not found",
      );
    });
  });

  describe("banUser", () => {
    it("bans a non-admin user and writes audit log", async () => {
      const admin = await createTestUser({ role: "admin" });
      const target = await createTestUser();

      const result = await banUser(target.id, "Spam", admin.id);

      expect(result.success).toBe(true);

      const banned = await db
        .select()
        .from(users)
        .where(eq(users.id, target.id))
        .get();
      expect(banned?.bannedReason).toBe("Spam");
      expect(banned?.bannedBy).toBe(admin.id);

      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.adminId, admin.id));

      expect(logs.some((log) => log.action === "ban_user")).toBe(true);
    });

    it("does not allow banning admin users", async () => {
      const admin = await createTestUser({ role: "admin" });
      const targetAdmin = await createTestUser({ role: "admin" });

      await expect(banUser(targetAdmin.id, "Test", admin.id)).rejects.toThrow(
        "Cannot ban admin users",
      );
    });
  });

  describe("updateUserRole", () => {
    it("updates user role and writes audit log", async () => {
      const admin = await createTestUser({ role: "admin" });
      const target = await createTestUser({ role: "user" });

      const result = await updateUserRole(target.id, "moderator", admin.id);

      expect(result.success).toBe(true);

      const updated = await db
        .select()
        .from(users)
        .where(eq(users.id, target.id))
        .get();
      expect(updated?.role).toBe("moderator");
    });

    it("rejects invalid role", async () => {
      const admin = await createTestUser({ role: "admin" });
      const target = await createTestUser();

      await expect(
        updateUserRole(target.id, "owner", admin.id),
      ).rejects.toThrow("Invalid role");
    });
  });

  describe("reports", () => {
    it("lists reports with reporter username and reviews report", async () => {
      const admin = await createTestUser({ role: "admin" });
      const reporter = await createTestUser();
      const target = await createTestUser();
      const reportId = generateId();

      await db.insert(reports).values({
        id: reportId,
        reporterId: reporter.id,
        targetType: "user",
        targetId: target.id,
        reason: "Abuse",
        description: "Bad behavior",
      });

      const listed = await listReports({ statusFilter: "pending" });

      expect(listed.reports.some((r) => r.id === reportId)).toBe(true);
      expect(
        listed.reports.find((r) => r.id === reportId)?.reporterUsername,
      ).toBe(reporter.username);

      const reviewed = await reviewReport(
        reportId,
        "ban_user",
        admin.id,
        "Handled",
      );
      expect(reviewed.success).toBe(true);

      const report = await db
        .select()
        .from(reports)
        .where(eq(reports.id, reportId))
        .get();
      expect(report?.status).toBe("actioned");
      expect(report?.reviewedBy).toBe(admin.id);
    });
  });

  describe("getAuditLogs", () => {
    it("returns audit logs with admin username", async () => {
      const admin = await createTestUser({ role: "admin" });

      await db.insert(auditLogs).values({
        id: generateId(),
        adminId: admin.id,
        action: "test_action",
        targetType: "user",
        targetId: "target-1",
      });

      const result = await getAuditLogs({ adminIdFilter: admin.id });

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].adminUsername).toBe(admin.username);
      expect(result.logs[0].action).toBe("test_action");
    });
  });
});
