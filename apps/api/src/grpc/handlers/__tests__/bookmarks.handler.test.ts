import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bookmarksHandler } from "../bookmarks.handler";

vi.mock("../../../services/bookmarks.service", () => ({
  toggleBookmark: vi.fn(),
  getBookmarkStatus: vi.fn(),
  getBookmarkedPosts: vi.fn(),
}));

vi.mock("../../../middleware/auth", () => ({
  validateSessionToken: vi.fn(),
}));

import { validateSessionToken } from "../../../middleware/auth";
import {
  getBookmarkedPosts,
  getBookmarkStatus,
  toggleBookmark,
} from "../../../services/bookmarks.service";
import { notFound, unauthenticated, validationFailed } from "../../../error";

describe("BookmarksHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("toggleBookmark", () => {
    it("bookmarks a post with valid session token", async () => {
      vi.mocked(validateSessionToken).mockReturnValue({
        userId: "user-123",
        username: "testuser",
        role: "user",
      });

      vi.mocked(toggleBookmark).mockResolvedValue({ bookmarked: true });

      const result = await bookmarksHandler.toggleBookmark({
        sessionToken: "valid-token",
        postId: "post-456",
      });

      expect(result.success).toBe(true);
      expect(result.bookmarked).toBe(true);
      expect(toggleBookmark).toHaveBeenCalledWith("post-456", "user-123");
    });

    it("removes an existing bookmark", async () => {
      vi.mocked(validateSessionToken).mockReturnValue({
        userId: "user-123",
        username: "testuser",
        role: "user",
      });

      vi.mocked(toggleBookmark).mockResolvedValue({ bookmarked: false });

      const result = await bookmarksHandler.toggleBookmark({
        sessionToken: "valid-token",
        postId: "post-456",
      });

      expect(result.success).toBe(true);
      expect(result.bookmarked).toBe(false);
    });

    it("returns error response for invalid session token", async () => {
      vi.mocked(validateSessionToken).mockImplementation(() => {
        throw validationFailed("Invalid or expired session token");
      });

      const result = await bookmarksHandler.toggleBookmark({
        sessionToken: "invalid-token",
        postId: "post-456",
      });

      expect(result.success).toBe(false);
      expect(result.bookmarked).toBe(false);
      expect(result.error).toContain("Invalid or expired session token");
      expect(result.error).toContain("traceId:");
    });

    it("returns error response when post is not found", async () => {
      vi.mocked(validateSessionToken).mockReturnValue({
        userId: "user-123",
        username: "testuser",
        role: "user",
      });

      vi.mocked(toggleBookmark).mockRejectedValue(notFound("Post not found"));

      const result = await bookmarksHandler.toggleBookmark({
        sessionToken: "valid-token",
        postId: "missing-post",
      });

      expect(result.success).toBe(false);
      expect(result.bookmarked).toBe(false);
      expect(result.error).toContain("Post not found");
      expect(result.error).toContain("traceId:");
    });
  });

  describe("getBookmarkStatus", () => {
    it("returns bookmarked status for valid session", async () => {
      vi.mocked(validateSessionToken).mockReturnValue({
        userId: "user-123",
        username: "testuser",
        role: "user",
      });

      vi.mocked(getBookmarkStatus).mockResolvedValue({ bookmarked: true });

      const result = await bookmarksHandler.getBookmarkStatus({
        sessionToken: "valid-token",
        postId: "post-456",
      });

      expect(result.bookmarked).toBe(true);
      expect(getBookmarkStatus).toHaveBeenCalledWith("post-456", "user-123");
    });

    it("returns false when post is not bookmarked", async () => {
      vi.mocked(validateSessionToken).mockReturnValue({
        userId: "user-123",
        username: "testuser",
        role: "user",
      });

      vi.mocked(getBookmarkStatus).mockResolvedValue({ bookmarked: false });

      const result = await bookmarksHandler.getBookmarkStatus({
        sessionToken: "valid-token",
        postId: "post-456",
      });

      expect(result.bookmarked).toBe(false);
    });

    it("throws unauthenticated for invalid token", async () => {
      vi.mocked(validateSessionToken).mockImplementation(() => {
        throw unauthenticated("Invalid token");
      });

      await expect(
        bookmarksHandler.getBookmarkStatus({
          sessionToken: "invalid-token",
          postId: "post-456",
        }),
      ).rejects.toThrow("Invalid token");
    });
  });

  describe("getBookmarkedPosts", () => {
    it("returns bookmarked posts with pagination", async () => {
      vi.mocked(validateSessionToken).mockReturnValue({
        userId: "user-123",
        username: "testuser",
        role: "user",
      });

      vi.mocked(getBookmarkedPosts).mockResolvedValue([
        {
          id: "post-1",
          content: "Bookmarked post",
          createdAt: new Date("2024-01-15T10:00:00Z"),
          updatedAt: new Date("2024-01-15T11:00:00Z"),
          author: {
            id: "author-1",
            username: "author",
            displayName: "Author User",
            avatarUrl: "https://example.com/avatar.png",
          },
          likeCount: 5,
          commentCount: 2,
          isLiked: true,
        },
      ]);

      const result = await bookmarksHandler.getBookmarkedPosts({
        sessionToken: "valid-token",
        limit: 10,
        offset: 20,
      });

      expect(result.posts).toHaveLength(1);
      expect(result.posts[0].id).toBe("post-1");
      expect(result.posts[0].author?.username).toBe("author");
      expect(result.posts[0].likeCount).toBe(5);
      expect(result.posts[0].commentCount).toBe(2);
      expect(result.posts[0].isLiked).toBe(true);
      expect(getBookmarkedPosts).toHaveBeenCalledWith(
        "user-123",
        "user-123",
        10,
        20,
      );
    });

    it("uses default pagination when limit and offset are omitted", async () => {
      vi.mocked(validateSessionToken).mockReturnValue({
        userId: "user-123",
        username: "testuser",
        role: "user",
      });

      vi.mocked(getBookmarkedPosts).mockResolvedValue([]);

      const result = await bookmarksHandler.getBookmarkedPosts({
        sessionToken: "adminToken",
        limit: 20,
        offset: 0,
      });

      expect(result.posts).toEqual([]);
      expect(getBookmarkedPosts).toHaveBeenCalledWith(
        "user-123",
        "user-123",
        20,
        0,
      );
    });

    it("maps missing author and metric fields to safe defaults", async () => {
      vi.mocked(validateSessionToken).mockReturnValue({
        userId: "user-123",
        username: "testuser",
        role: "user",
      });

      vi.mocked(getBookmarkedPosts).mockResolvedValue([
        {
          id: "post-1",
          content: "Post without author",
          createdAt: new Date("2024-01-15T10:00:00Z"),
          updatedAt: new Date("2024-01-15T10:00:00Z"),
          author: null,
          likeCount: 1,
          commentCount: 0,
          isLiked: false,
        },
      ]);

      const result = await bookmarksHandler.getBookmarkedPosts({
        sessionToken: "valid-token",
        limit: 10,
        offset: 0,
      });

      expect(result.posts[0].author).toEqual({
        id: "",
        username: "",
        displayName: "",
      });
      expect(result.posts[0].likeCount).toBe(1);
      expect(result.posts[0].commentCount).toBe(0);
      expect(result.posts[0].isLiked).toBe(false);
    });

    it("throws unauthenticated for invalid token", async () => {
      vi.mocked(validateSessionToken).mockImplementation(() => {
        throw unauthenticated("Invalid token");
      });

      await expect(
        bookmarksHandler.getBookmarkedPosts({
          sessionToken: "invalid-token",
          limit: 10,
          offset: 0,
        }),
      ).rejects.toThrow("Invalid token");
    });
  });
});
