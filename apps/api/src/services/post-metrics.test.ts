import { describe, expect, it } from "vitest";
import {
  createTestComment,
  createTestLike,
  createTestPost,
  createTestUser,
} from "../../tests/helpers";
import { getPostMetrics } from "./post-metrics";

describe("PostMetrics", () => {
  describe("getPostMetrics", () => {
    it("returns empty map for empty post ids", async () => {
      const result = await getPostMetrics([]);

      expect(result.size).toBe(0);
    });

    it("returns default metrics for posts with no likes or comments", async () => {
      const author = await createTestUser();
      const postId = await createTestPost(author.id, "Post without activity");

      const result = await getPostMetrics([postId]);

      expect(result.get(postId)).toEqual({
        likeCount: 0,
        commentCount: 0,
        isLiked: false,
      });
    });

    it("counts likes and comments for a post", async () => {
      const author = await createTestUser();
      const liker1 = await createTestUser();
      const liker2 = await createTestUser();
      const commenter1 = await createTestUser();
      const commenter2 = await createTestUser();

      const postId = await createTestPost(author.id, "Post with activity");

      await createTestLike(liker1.id, postId);
      await createTestLike(liker2.id, postId);

      await createTestComment(postId, commenter1.id, "First comment");
      await createTestComment(postId, commenter2.id, "Second comment");

      const result = await getPostMetrics([postId]);

      expect(result.get(postId)).toEqual({
        likeCount: 2,
        commentCount: 2,
        isLiked: false,
      });
    });

    it("sets isLiked true when requester liked the post", async () => {
      const author = await createTestUser();
      const requester = await createTestUser();

      const postId = await createTestPost(author.id, "Liked post");
      await createTestLike(requester.id, postId);

      const result = await getPostMetrics([postId], requester.id);

      expect(result.get(postId)?.isLiked).toBe(true);
      expect(result.get(postId)?.likeCount).toBe(1);
    });

    it("sets isLiked false when requester did not like the post", async () => {
      const author = await createTestUser();
      const liker = await createTestUser();
      const requester = await createTestUser();

      const postId = await createTestPost(author.id, "Liked by someone else");
      await createTestLike(liker.id, postId);

      const result = await getPostMetrics([postId], requester.id);

      expect(result.get(postId)?.isLiked).toBe(false);
      expect(result.get(postId)?.likeCount).toBe(1);
    });

    it("returns metrics for multiple posts independently", async () => {
      const author = await createTestUser();
      const requester = await createTestUser();
      const commenter = await createTestUser();

      const postA = await createTestPost(author.id, "Post A");
      const postB = await createTestPost(author.id, "Post B");
      const postC = await createTestPost(author.id, "Post C");

      await createTestLike(requester.id, postA);
      await createTestLike(requester.id, postB);

      await createTestComment(postA, commenter.id, "Comment on A");
      await createTestComment(postA, commenter.id, "Second comment on A");
      await createTestComment(postC, commenter.id, "Comment on C");

      const result = await getPostMetrics([postA, postB, postC], requester.id);

      expect(result.get(postA)).toEqual({
        likeCount: 1,
        commentCount: 2,
        isLiked: true,
      });

      expect(result.get(postB)).toEqual({
        likeCount: 1,
        commentCount: 0,
        isLiked: true,
      });

      expect(result.get(postC)).toEqual({
        likeCount: 0,
        commentCount: 1,
        isLiked: false,
      });
    });

    it("ignores activity for posts that were not requested", async () => {
      const author = await createTestUser();
      const user = await createTestUser();

      const requestedPost = await createTestPost(author.id, "Requested post");
      const otherPost = await createTestPost(author.id, "Other post");

      await createTestLike(user.id, otherPost);
      await createTestComment(otherPost, user.id, "Other comment");

      const result = await getPostMetrics([requestedPost], user.id);

      expect(result.get(requestedPost)).toEqual({
        likeCount: 0,
        commentCount: 0,
        isLiked: false,
      });

      expect(result.has(otherPost)).toBe(false);
    });
  });
});
