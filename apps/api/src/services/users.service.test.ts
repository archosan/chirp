import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db, schema } from "../db";
import {
  createTestFollow,
  createTestPost,
  createTestUser,
} from "../../tests/helpers";
import { getUser, updateProfile } from "./users.service";

const { users } = schema;

describe("UsersService", () => {
  describe("getUser", () => {
    it("returns user profile with counts", async () => {
      const user = await createTestUser({
        username: "profile_counts_user",
        displayName: "Profile Counts User",
      });

      const follower1 = await createTestUser();
      const follower2 = await createTestUser();
      const following = await createTestUser();

      await createTestFollow(follower1.id, user.id);
      await createTestFollow(follower2.id, user.id);
      await createTestFollow(user.id, following.id);

      await createTestPost(user.id, "First user post");
      await createTestPost(user.id, "Second user post");

      const result = await getUser(user.username);

      expect(result.id).toBe(user.id);
      expect(result.email).toBe(user.email);
      expect(result.username).toBe(user.username);
      expect(result.displayName).toBe(user.displayName);
      expect(result.role).toBe("user");
      expect(result.followerCount).toBe(2);
      expect(result.followingCount).toBe(1);
      expect(result.postCount).toBe(2);
      expect(result.isFollowing).toBe(false);
      expect(result.createdAt).toBeDefined();
    });

    it("sets isFollowing true when requester follows user", async () => {
      const target = await createTestUser();
      const requester = await createTestUser();

      await createTestFollow(requester.id, target.id);

      const result = await getUser(target.username, requester.id);

      expect(result.isFollowing).toBe(true);
    });

    it("sets isFollowing false when requester does not follow user", async () => {
      const target = await createTestUser();
      const requester = await createTestUser();

      const result = await getUser(target.username, requester.id);

      expect(result.isFollowing).toBe(false);
    });

    it("sets isFollowing false when requester is the same user", async () => {
      const user = await createTestUser();

      const result = await getUser(user.username, user.id);

      expect(result.isFollowing).toBe(false);
    });

    it("includes optional avatarUrl and bio", async () => {
      const user = await createTestUser({
        username: "profile_optional_fields",
      });

      await db
        .update(users)
        .set({
          avatarUrl: "https://example.com/avatar.png",
          bio: "Test bio",
        })
        .where(eq(users.id, user.id));

      const result = await getUser(user.username);

      expect(result.avatarUrl).toBe("https://example.com/avatar.png");
      expect(result.bio).toBe("Test bio");
    });

    it("throws when user does not exist", async () => {
      await expect(getUser("missing-user")).rejects.toThrow("User not found");
    });
  });

  describe("updateProfile", () => {
    it("updates displayName bio and avatarUrl", async () => {
      const user = await createTestUser();

      const result = await updateProfile({
        userId: user.id,
        displayName: "Updated Name",
        bio: "Updated bio",
        avatarUrl: "https://example.com/updated.png",
      });

      expect(result.success).toBe(true);

      const updated = await db
        .select()
        .from(users)
        .where(eq(users.id, user.id))
        .get();

      expect(updated?.displayName).toBe("Updated Name");
      expect(updated?.bio).toBe("Updated bio");
      expect(updated?.avatarUrl).toBe("https://example.com/updated.png");
    });

    it("updates only provided fields", async () => {
      const user = await createTestUser({
        displayName: "Original Name",
      });

      await db
        .update(users)
        .set({
          bio: "Original bio",
          avatarUrl: "https://example.com/original.png",
        })
        .where(eq(users.id, user.id));

      await updateProfile({
        userId: user.id,
        displayName: "Only Name Updated",
      });

      const updated = await db
        .select()
        .from(users)
        .where(eq(users.id, user.id))
        .get();

      expect(updated?.displayName).toBe("Only Name Updated");
      expect(updated?.bio).toBe("Original bio");
      expect(updated?.avatarUrl).toBe("https://example.com/original.png");
    });

    it("allows empty strings when explicitly provided", async () => {
      const user = await createTestUser();

      await updateProfile({
        userId: user.id,
        displayName: "",
        bio: "",
        avatarUrl: "",
      });

      const updated = await db
        .select()
        .from(users)
        .where(eq(users.id, user.id))
        .get();

      expect(updated?.displayName).toBe("");
      expect(updated?.bio).toBe("");
      expect(updated?.avatarUrl).toBe("");
    });

    it("returns success without changes when no profile fields are provided", async () => {
      const user = await createTestUser({
        displayName: "No Change User",
      });

      const result = await updateProfile({
        userId: user.id,
      });

      expect(result.success).toBe(true);

      const unchanged = await db
        .select()
        .from(users)
        .where(eq(users.id, user.id))
        .get();

      expect(unchanged?.displayName).toBe("No Change User");
    });

    it("returns success even when user id does not exist", async () => {
      const result = await updateProfile({
        userId: "missing-user-id",
        displayName: "Nobody",
      });

      expect(result.success).toBe(true);
    });
  });
});
