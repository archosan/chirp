import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db, schema } from "../db";
import {
  createTestComment,
  createTestPost,
  createTestUser,
} from "../../tests/helpers";
import {
  createMentionNotifications,
  extractMentions,
  processMentions,
  validateMentionedUsers,
} from "./mentions.service";

const { notifications } = schema;

describe("MentionsService", () => {
  describe("extractMentions", () => {
    it("extracts usernames from content", () => {
      const result = extractMentions("Hello @alice and @bob");

      expect(result).toEqual(["alice", "bob"]);
    });

    it("returns unique usernames only", () => {
      const result = extractMentions("@alice hi @alice again @bob");

      expect(result).toEqual(["alice", "bob"]);
    });

    it("supports letters numbers and underscores", () => {
      const result = extractMentions("Hi @user_123 and @UserABC");

      expect(result).toEqual(["user_123", "UserABC"]);
    });

    it("returns empty array when there are no mentions", () => {
      const result = extractMentions("No mentions here");

      expect(result).toEqual([]);
    });
  });

  describe("validateMentionedUsers", () => {
    it("returns username to userId map for existing users", async () => {
      const alice = await createTestUser({ username: "mention_alice" });
      const bob = await createTestUser({ username: "mention_bob" });

      const result = await validateMentionedUsers([
        "mention_alice",
        "mention_bob",
        "missing_user",
      ]);

      expect(result.get("mention_alice")).toBe(alice.id);
      expect(result.get("mention_bob")).toBe(bob.id);
      expect(result.has("missing_user")).toBe(false);
    });

    it("returns empty map for empty input", async () => {
      const result = await validateMentionedUsers([]);

      expect(result.size).toBe(0);
    });
  });

  describe("createMentionNotifications", () => {
    it("creates mention notifications for mentioned users", async () => {
      const actor = await createTestUser();
      const mentioned = await createTestUser();

      await createMentionNotifications([mentioned.id], actor.id);

      const rows = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, mentioned.id));

      expect(rows).toHaveLength(1);
      expect(rows[0].type).toBe("mention");
      expect(rows[0].actorId).toBe(actor.id);
    });

    it("does not notify actor for self mention", async () => {
      const actor = await createTestUser();

      await createMentionNotifications([actor.id], actor.id);

      const rows = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, actor.id),
            eq(notifications.type, "mention"),
          ),
        );

      expect(rows).toHaveLength(0);
    });

    it("stores postId and commentId when provided", async () => {
      const actor = await createTestUser();
      const mentioned = await createTestUser();
      const postId = await createTestPost(actor.id, "Post with mention");
      const commentId = await createTestComment(postId, actor.id, "Comment");

      await createMentionNotifications(
        [mentioned.id],
        actor.id,
        postId,
        commentId,
      );

      const rows = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, mentioned.id));

      expect(rows).toHaveLength(1);
      expect(rows[0].postId).toBe(postId);
      expect(rows[0].commentId).toBe(commentId);
    });
  });

  describe("processMentions", () => {
    it("extracts valid mentions and creates notifications", async () => {
      const actor = await createTestUser();
      const mentioned = await createTestUser({ username: "mentioned_user" });
      const postId = await createTestPost(actor.id, "Hello @mentioned_user");

      await processMentions("Hello @mentioned_user", actor.id, postId);

      const rows = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, mentioned.id));

      expect(rows).toHaveLength(1);
      expect(rows[0].type).toBe("mention");
      expect(rows[0].actorId).toBe(actor.id);
      expect(rows[0].postId).toBe(postId);
    });

    it("ignores missing usernames", async () => {
      const actor = await createTestUser();

      await processMentions("Hello @does_not_exist", actor.id);

      const rows = await db
        .select()
        .from(notifications)
        .where(eq(notifications.actorId, actor.id));

      expect(rows).toHaveLength(0);
    });

    it("does nothing when content has no mentions", async () => {
      const actor = await createTestUser();

      await processMentions("No mentions here", actor.id);

      const rows = await db
        .select()
        .from(notifications)
        .where(eq(notifications.actorId, actor.id));

      expect(rows).toHaveLength(0);
    });

    it("does not create notification for self mention", async () => {
      const actor = await createTestUser({ username: "self_user" });

      await processMentions("Hello @self_user", actor.id);

      const rows = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, actor.id));

      expect(rows).toHaveLength(0);
    });
  });
});
