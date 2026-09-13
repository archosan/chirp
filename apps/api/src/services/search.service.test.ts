import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db, schema } from "../db";
import {
  createTestComment,
  createTestLike,
  createTestPost,
  createTestUser,
} from "../../tests/helpers";
import { searchPosts, searchUsers } from "./search.service";

const { users } = schema;

describe("SearchService", () => {
  describe("searchPosts", () => {
    it("returns empty array for empty query", async () => {
      expect(await searchPosts("")).toEqual([]);
      expect(await searchPosts("   ")).toEqual([]);
    });

    it("returns posts matching content", async () => {
      const author = await createTestUser();
      const matchingPostId = await createTestPost(
        author.id,
        "This post contains searchable banana content",
      );
      await createTestPost(author.id, "This post should not match");

      const result = await searchPosts("banana");

      expect(result.some((post) => post.id === matchingPostId)).toBe(true);
      expect(result.every((post) => post.content.includes("banana"))).toBe(
        true,
      );
    });

    it("includes author data", async () => {
      const author = await createTestUser({
        username: "search_author",
        displayName: "Search Author",
      });

      const postId = await createTestPost(
        author.id,
        "Unique author search phrase",
      );

      const result = await searchPosts("Unique author search phrase");
      const post = result.find((p) => p.id === postId);

      expect(post?.author?.id).toBe(author.id);
      expect(post?.author?.username).toBe("search_author");
      expect(post?.author?.displayName).toBe("Search Author");
    });

    it("includes like and comment counts", async () => {
      const author = await createTestUser();
      const liker1 = await createTestUser();
      const liker2 = await createTestUser();
      const commenter = await createTestUser();

      const postId = await createTestPost(author.id, "Metrics searchable post");

      await createTestLike(liker1.id, postId);
      await createTestLike(liker2.id, postId);
      await createTestComment(postId, commenter.id, "First comment");
      await createTestComment(postId, commenter.id, "Second comment");

      const result = await searchPosts("Metrics searchable post");
      const post = result.find((p) => p.id === postId);

      expect(post?.likeCount).toBe(2);
      expect(post?.commentCount).toBe(2);
      expect(post?.isLiked).toBe(false);
    });

    it("sets isLiked for requesting user", async () => {
      const author = await createTestUser();
      const requester = await createTestUser();

      const postId = await createTestPost(
        author.id,
        "Requester liked searchable post",
      );

      await createTestLike(requester.id, postId);

      const result = await searchPosts(
        "Requester liked searchable post",
        requester.id,
      );

      const post = result.find((p) => p.id === postId);

      expect(post?.isLiked).toBe(true);
      expect(post?.likeCount).toBe(1);
    });

    it("does not set isLiked when another user liked the post", async () => {
      const author = await createTestUser();
      const liker = await createTestUser();
      const requester = await createTestUser();

      const postId = await createTestPost(
        author.id,
        "Other user liked searchable post",
      );

      await createTestLike(liker.id, postId);

      const result = await searchPosts(
        "Other user liked searchable post",
        requester.id,
      );

      const post = result.find((p) => p.id === postId);

      expect(post?.isLiked).toBe(false);
      expect(post?.likeCount).toBe(1);
    });
  });

  describe("searchUsers", () => {
    it("returns empty array for empty query", async () => {
      expect(await searchUsers("")).toEqual([]);
      expect(await searchUsers("   ")).toEqual([]);
    });

    it("finds users by username", async () => {
      const user = await createTestUser({
        username: "searchable_username",
        displayName: "Regular Name",
      });

      const result = await searchUsers("searchable_username");

      expect(result.some((u) => u.id === user.id)).toBe(true);
    });

    it("finds users by display name", async () => {
      const user = await createTestUser({
        username: "regular_username",
        displayName: "Searchable Display Name",
      });

      const result = await searchUsers("Searchable Display");

      expect(result.some((u) => u.id === user.id)).toBe(true);
    });

    it("returns profile fields for matched users", async () => {
      const user = await createTestUser({
        username: "profile_search_user",
        displayName: "Profile Search User",
      });

      await db
        .update(users)
        .set({
          avatarUrl: "https://example.com/avatar.png",
          bio: "Searchable bio",
        })
        .where(eq(users.id, user.id));

      const result = await searchUsers("profile_search_user");
      const found = result.find((u) => u.id === user.id);

      expect(found).toEqual({
        id: user.id,
        username: "profile_search_user",
        displayName: "Profile Search User",
        avatarUrl: "https://example.com/avatar.png",
        bio: "Searchable bio",
      });
    });

    it("does not return users that do not match", async () => {
      const user = await createTestUser({
        username: "not_matching_user",
        displayName: "Not Matching User",
      });

      const result = await searchUsers("definitely_missing_query");

      expect(result.some((u) => u.id === user.id)).toBe(false);
    });
  });
});
