import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchHandler } from "../search.handler";

vi.mock("../../../services/search.service", () => ({
  searchPosts: vi.fn(),
  searchUsers: vi.fn(),
}));

vi.mock("../../../middleware/auth", () => ({
  validateSessionToken: vi.fn(),
}));

vi.mock("../../../observability/logger", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { validateSessionToken } from "../../../middleware/auth";
import { logger } from "../../../observability/logger";
import { searchPosts, searchUsers } from "../../../services/search.service";
import { unauthenticated } from "../../../error";

describe("SearchHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("searchPosts", () => {
    const mockPost = {
      id: "post-123",
      content: "Searchable post content",
      createdAt: new Date("2024-01-15T10:00:00Z"),
      updatedAt: new Date("2024-01-15T11:00:00Z"),
      author: {
        id: "author-123",
        username: "author",
        displayName: "Author User",
        avatarUrl: "https://example.com/avatar.png",
      },
      likeCount: 5,
      commentCount: 2,
      isLiked: true,
    };

    it("searches posts without authentication", async () => {
      vi.mocked(searchPosts).mockResolvedValue([mockPost]);

      const result = await searchHandler.searchPosts({
        query: "searchable",
      });

      expect(result.posts).toHaveLength(1);
      expect(result.posts[0].id).toBe("post-123");
      expect(result.posts[0].content).toBe("Searchable post content");
      expect(result.posts[0].author?.username).toBe("author");
      expect(result.posts[0].likeCount).toBe(5);
      expect(result.posts[0].commentCount).toBe(2);
      expect(result.posts[0].isLiked).toBe(true);

      expect(validateSessionToken).not.toHaveBeenCalled();
      expect(searchPosts).toHaveBeenCalledWith("searchable", undefined);
    });

    it("passes userId when optional session token is valid", async () => {
      vi.mocked(validateSessionToken).mockReturnValue({
        userId: "user-123",
        username: "testuser",
        role: "user",
      });

      vi.mocked(searchPosts).mockResolvedValue([mockPost]);

      const result = await searchHandler.searchPosts({
        query: "searchable",
        sessionToken: "valid-token",
      });

      expect(result.posts).toHaveLength(1);
      expect(validateSessionToken).toHaveBeenCalledWith("valid-token");
      expect(searchPosts).toHaveBeenCalledWith("searchable", "user-123");
    });

    it("ignores invalid optional token and searches anonymously", async () => {
      vi.mocked(validateSessionToken).mockImplementation(() => {
        throw unauthenticated("Invalid token");
      });

      vi.mocked(searchPosts).mockResolvedValue([]);

      const result = await searchHandler.searchPosts({
        query: "searchable",
        sessionToken: "invalid-token",
      });

      expect(result.posts).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith("auth.optional_token_invalid", {
        message: "Invalid token",
      });
      expect(searchPosts).toHaveBeenCalledWith("searchable", undefined);
    });

    it("maps missing author and metric fields to safe defaults", async () => {
      vi.mocked(searchPosts).mockResolvedValue([
        {
          id: "post-456",
          content: "Post without author",
          createdAt: new Date("2024-01-15T10:00:00Z"),
          updatedAt: new Date("2024-01-15T10:00:00Z"),
          author: null,
          likeCount: 0,
          commentCount: 0,
          isLiked: false,
        },
      ]);

      const result = await searchHandler.searchPosts({
        query: "post",
      });

      expect(result.posts[0].author).toEqual({
        id: "",
        username: "",
        displayName: "",
      });
      expect(result.posts[0].likeCount).toBe(0);
      expect(result.posts[0].commentCount).toBe(0);
      expect(result.posts[0].isLiked).toBe(false);
    });

    it("throws when searchPosts service fails", async () => {
      vi.mocked(searchPosts).mockRejectedValue(new Error("database exploded"));

      await expect(
        searchHandler.searchPosts({
          query: "post",
        }),
      ).rejects.toThrow("Internal server error");
    });
  });

  describe("searchUsers", () => {
    it("searches users without authentication", async () => {
      vi.mocked(searchUsers).mockResolvedValue([
        {
          id: "user-123",
          username: "testuser",
          displayName: "Test User",
          avatarUrl: "https://example.com/avatar.png",
          bio: "Hello there",
        },
      ]);

      const result = await searchHandler.searchUsers({
        query: "test",
      });

      expect(result.users).toHaveLength(1);
      expect(result.users[0]).toEqual({
        id: "user-123",
        username: "testuser",
        displayName: "Test User",
        avatarUrl: "https://example.com/avatar.png",
        bio: "Hello there",
      });

      expect(validateSessionToken).not.toHaveBeenCalled();
      expect(searchUsers).toHaveBeenCalledWith("test");
    });

    it("maps missing optional user fields to undefined", async () => {
      vi.mocked(searchUsers).mockResolvedValue([
        {
          id: "user-123",
          username: "testuser",
          displayName: "Test User",
          avatarUrl: null,
          bio: null,
        },
      ]);

      const result = await searchHandler.searchUsers({
        query: "test",
      });

      expect(result.users[0].avatarUrl).toBeUndefined();
      expect(result.users[0].bio).toBeUndefined();
    });

    it("returns empty users array", async () => {
      vi.mocked(searchUsers).mockResolvedValue([]);

      const result = await searchHandler.searchUsers({
        query: "missing",
      });

      expect(result.users).toEqual([]);
      expect(searchUsers).toHaveBeenCalledWith("missing");
    });

    it("throws when searchUsers service fails", async () => {
      vi.mocked(searchUsers).mockRejectedValue(new Error("database exploded"));

      await expect(
        searchHandler.searchUsers({
          query: "test",
        }),
      ).rejects.toThrow("Internal server error");
    });
  });
});
