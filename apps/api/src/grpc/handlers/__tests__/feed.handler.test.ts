import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { feedHandler } from "../feed.handler";

vi.mock("../../../services/feed.service", () => ({
  getHomeFeed: vi.fn(),
  getExploreFeed: vi.fn(),
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
import { getExploreFeed, getHomeFeed } from "../../../services/feed.service";
import { logger } from "../../../observability/logger";
import { unauthenticated } from "../../../error";

describe("FeedHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  const mockPost = {
    id: "post-123",
    content: "Feed post",
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

  describe("getHomeFeed", () => {
    it("returns home feed for authenticated user", async () => {
      vi.mocked(validateSessionToken).mockReturnValue({
        userId: "user-123",
        username: "testuser",
        role: "user",
      });

      vi.mocked(getHomeFeed).mockResolvedValue([mockPost]);

      const result = await feedHandler.getHomeFeed({
        sessionToken: "valid-token",
        pagination: {
          limit: 10,
          offset: 20,
        },
      });

      expect(result.posts).toHaveLength(1);
      expect(result.posts[0].id).toBe("post-123");
      expect(result.posts[0].content).toBe("Feed post");
      expect(result.posts[0].author?.username).toBe("author");
      expect(result.posts[0].likeCount).toBe(5);
      expect(result.posts[0].commentCount).toBe(2);
      expect(result.posts[0].isLiked).toBe(true);

      expect(getHomeFeed).toHaveBeenCalledWith("user-123", {
        limit: 10,
        offset: 20,
      });
    });

    it("uses default pagination when pagination is omitted", async () => {
      vi.mocked(validateSessionToken).mockReturnValue({
        userId: "user-123",
        username: "testuser",
        role: "user",
      });

      vi.mocked(getHomeFeed).mockResolvedValue([]);

      const result = await feedHandler.getHomeFeed({
        sessionToken: "valid-token",
      });

      expect(result.posts).toEqual([]);
      expect(getHomeFeed).toHaveBeenCalledWith("user-123", {
        limit: 20,
        offset: 0,
      });
    });

    it("throws unauthenticated for invalid session token", async () => {
      vi.mocked(validateSessionToken).mockImplementation(() => {
        throw unauthenticated("Invalid token");
      });

      await expect(
        feedHandler.getHomeFeed({
          sessionToken: "invalid-token",
        }),
      ).rejects.toThrow("Invalid token");

      expect(getHomeFeed).not.toHaveBeenCalled();
    });
  });

  describe("getExploreFeed", () => {
    it("returns explore feed without authentication", async () => {
      vi.mocked(getExploreFeed).mockResolvedValue([mockPost]);

      const result = await feedHandler.getExploreFeed({
        pagination: {
          limit: 5,
          offset: 10,
        },
      });

      expect(result.posts).toHaveLength(1);
      expect(result.posts[0].id).toBe("post-123");

      expect(validateSessionToken).not.toHaveBeenCalled();
      expect(getExploreFeed).toHaveBeenCalledWith({
        limit: 5,
        offset: 10,
        userId: undefined,
      });
    });

    it("passes userId to explore feed when token is valid", async () => {
      vi.mocked(validateSessionToken).mockReturnValue({
        userId: "user-123",
        username: "testuser",
        role: "user",
      });

      vi.mocked(getExploreFeed).mockResolvedValue([mockPost]);

      const result = await feedHandler.getExploreFeed({
        sessionToken: "valid-token",
        pagination: {
          limit: 15,
          offset: 0,
        },
      });

      expect(result.posts).toHaveLength(1);
      expect(validateSessionToken).toHaveBeenCalledWith("valid-token");
      expect(getExploreFeed).toHaveBeenCalledWith({
        limit: 15,
        offset: 0,
        userId: "user-123",
      });
    });

    it("ignores invalid optional token and returns anonymous explore feed", async () => {
      vi.mocked(validateSessionToken).mockImplementation(() => {
        throw unauthenticated("Invalid token");
      });

      vi.mocked(getExploreFeed).mockResolvedValue([]);

      const result = await feedHandler.getExploreFeed({
        sessionToken: "invalid-token",
      });

      expect(result.posts).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith("auth.optional_token_invalid", {
        message: "Invalid token",
      });
      expect(getExploreFeed).toHaveBeenCalledWith({
        limit: 20,
        offset: 0,
        userId: undefined,
      });
    });

    it("maps missing author and metric fields to safe defaults", async () => {
      vi.mocked(getExploreFeed).mockResolvedValue([
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

      const result = await feedHandler.getExploreFeed({});

      expect(result.posts[0].author).toEqual({
        id: "",
        username: "",
        displayName: "",
      });
      expect(result.posts[0].likeCount).toBe(0);
      expect(result.posts[0].commentCount).toBe(0);
      expect(result.posts[0].isLiked).toBe(false);
    });
  });
});
