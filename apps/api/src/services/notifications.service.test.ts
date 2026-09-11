import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db, schema } from "../db";
import {
  createTestComment,
  createTestPost,
  createTestUser,
} from "../../tests/helpers";
import {
  createNotification,
  deleteNotification,
  getUnreadCount,
  getUserNotifications,
  markAllAsRead,
  markAsRead,
} from "./notifications.service";

const { notifications } = schema;

describe("NotificationsService", () => {
  describe("createNotification", () => {
    it("creates a notification", async () => {
      const recipient = await createTestUser();
      const actor = await createTestUser();

      const result = await createNotification({
        userId: recipient.id,
        type: "follow",
        actorId: actor.id,
      });

      expect(result?.notificationId).toBeDefined();

      const row = await db
        .select()
        .from(notifications)
        .where(eq(notifications.id, result!.notificationId))
        .get();

      expect(row?.userId).toBe(recipient.id);
      expect(row?.actorId).toBe(actor.id);
      expect(row?.type).toBe("follow");
      expect(row?.read).toBe(false);
    });

    it("does not create self-notification", async () => {
      const user = await createTestUser();

      const result = await createNotification({
        userId: user.id,
        type: "mention",
        actorId: user.id,
      });

      expect(result).toBeNull();

      const rows = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, user.id));

      expect(rows).toHaveLength(0);
    });
  });

  describe("getUserNotifications", () => {
    it("returns notifications with actor and content previews", async () => {
      const recipient = await createTestUser();
      const actor = await createTestUser();
      const postId = await createTestPost(
        actor.id,
        "This is a post content preview",
      );
      const commentId = await createTestComment(
        postId,
        actor.id,
        "This is a comment content preview",
      );

      await createNotification({
        userId: recipient.id,
        type: "comment",
        actorId: actor.id,
        postId,
        commentId,
      });

      const result = await getUserNotifications(recipient.id, 10, 0);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("comment");
      expect(result[0].read).toBe(false);
      expect(result[0].actor?.id).toBe(actor.id);
      expect(result[0].actor?.username).toBe(actor.username);
      expect(result[0].postId).toBe(postId);
      expect(result[0].commentId).toBe(commentId);
      expect(result[0].postContent).toBe("This is a post content preview");
      expect(result[0].commentContent).toBe(
        "This is a comment content preview",
      );
    });

    it("returns empty array for user with no notifications", async () => {
      const user = await createTestUser();

      const result = await getUserNotifications(user.id);

      expect(result).toEqual([]);
    });
  });

  describe("getUnreadCount", () => {
    it("returns unread notification count", async () => {
      const recipient = await createTestUser();
      const actor = await createTestUser();

      await createNotification({
        userId: recipient.id,
        type: "follow",
        actorId: actor.id,
      });

      await createNotification({
        userId: recipient.id,
        type: "mention",
        actorId: actor.id,
      });

      const result = await getUnreadCount(recipient.id);

      expect(result.count).toBe(2);
    });
  });

  describe("markAsRead", () => {
    it("marks a notification as read", async () => {
      const recipient = await createTestUser();
      const actor = await createTestUser();

      const notification = await createNotification({
        userId: recipient.id,
        type: "follow",
        actorId: actor.id,
      });

      const result = await markAsRead(
        notification!.notificationId,
        recipient.id,
      );

      expect(result.success).toBe(true);

      const row = await db
        .select()
        .from(notifications)
        .where(eq(notifications.id, notification!.notificationId))
        .get();

      expect(row?.read).toBe(true);
    });

    it("throws when notification does not exist", async () => {
      const user = await createTestUser();

      await expect(markAsRead("missing-notification", user.id)).rejects.toThrow(
        "Notification not found",
      );
    });

    it("throws when user does not own notification", async () => {
      const owner = await createTestUser();
      const actor = await createTestUser();
      const otherUser = await createTestUser();

      const notification = await createNotification({
        userId: owner.id,
        type: "follow",
        actorId: actor.id,
      });

      await expect(
        markAsRead(notification!.notificationId, otherUser.id),
      ).rejects.toThrow("Unauthorized");
    });
  });

  describe("markAllAsRead", () => {
    it("marks all notifications as read for user", async () => {
      const recipient = await createTestUser();
      const actor = await createTestUser();

      await createNotification({
        userId: recipient.id,
        type: "follow",
        actorId: actor.id,
      });

      await createNotification({
        userId: recipient.id,
        type: "mention",
        actorId: actor.id,
      });

      const result = await markAllAsRead(recipient.id);

      expect(result.success).toBe(true);

      const unread = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, recipient.id),
            eq(notifications.read, false),
          ),
        );

      expect(unread).toHaveLength(0);
    });
  });

  describe("deleteNotification", () => {
    it("deletes notification", async () => {
      const recipient = await createTestUser();
      const actor = await createTestUser();

      const notification = await createNotification({
        userId: recipient.id,
        type: "follow",
        actorId: actor.id,
      });

      const result = await deleteNotification(
        notification!.notificationId,
        recipient.id,
      );

      expect(result.success).toBe(true);

      const row = await db
        .select()
        .from(notifications)
        .where(eq(notifications.id, notification!.notificationId))
        .get();

      expect(row).toBeUndefined();
    });

    it("throws when notification does not exist", async () => {
      const user = await createTestUser();

      await expect(
        deleteNotification("missing-notification", user.id),
      ).rejects.toThrow("Notification not found");
    });

    it("throws when user does not own notification", async () => {
      const owner = await createTestUser();
      const actor = await createTestUser();
      const otherUser = await createTestUser();

      const notification = await createNotification({
        userId: owner.id,
        type: "follow",
        actorId: actor.id,
      });

      await expect(
        deleteNotification(notification!.notificationId, otherUser.id),
      ).rejects.toThrow("Unauthorized");
    });
  });
});
