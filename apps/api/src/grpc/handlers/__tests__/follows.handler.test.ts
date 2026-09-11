import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { followsHandler } from "../follows.handler";

vi.mock("../../../services/follows.service", () => ({
  toggleFollow: vi.fn(),
  getFollowStatus: vi.fn(),
  getFollowerCount: vi.fn(),
  getFollowingCount: vi.fn(),
}));

vi.mock("../../../middleware/auth", () => ({
  validateSessionToken: vi.fn(),
}));

import { validateSessionToken } from "../../../middleware/auth";
import {
  getFollowerCount,
  getFollowingCount,
  getFollowStatus,
  toggleFollow,
} from "../../../services/follows.service";
import { notFound, unauthenticated, validationFailed } from "../../../error";

describe("FollowsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("toggleFollow", () => {
    it("follows a user with valid session token", async () => {
      vi.mocked(validateSessionToken).mockReturnValue({
        userId: "user-123",
        username: "viewer",
        role: "user",
      });

      vi.mocked(toggleFollow).mockResolvedValue({ following: true });

      const result = await followsHandler.toggleFollow({
        sessionToken: "valid-token",
        username: "targetuser",
      });

      expect(result.success).toBe(true);
      expect(result.following).toBe(true);
      expect(toggleFollow).toHaveBeenCalledWith("targetuser", "user-123");
    });

    it("unfollows an already followed user", async () => {
      vi.mocked(validateSessionToken).mockReturnValue({
        userId: "user-123",
        username: "viewer",
        role: "user",
      });

      vi.mocked(toggleFollow).mockResolvedValue({ following: false });

      const result = await followsHandler.toggleFollow({
        sessionToken: "valid-token",
        username: "targetuser",
      });

      expect(result.success).toBe(true);
      expect(result.following).toBe(false);
    });

    it("returns error response for invalid session token", async () => {
      vi.mocked(validateSessionToken).mockImplementation(() => {
        throw validationFailed("Invalid or expired session token");
      });

      const result = await followsHandler.toggleFollow({
        sessionToken: "invalid-token",
        username: "targetuser",
      });

      expect(result.success).toBe(false);
      expect(result.following).toBe(false);
      expect(result.error).toContain("Invalid or expired session token");
      expect(result.error).toContain("traceId:");
      expect(toggleFollow).not.toHaveBeenCalled();
    });

    it("returns error response when target user is not found", async () => {
      vi.mocked(validateSessionToken).mockReturnValue({
        userId: "user-123",
        username: "viewer",
        role: "user",
      });

      vi.mocked(toggleFollow).mockRejectedValue(notFound("User not found"));

      const result = await followsHandler.toggleFollow({
        sessionToken: "valid-token",
        username: "missinguser",
      });

      expect(result.success).toBe(false);
      expect(result.following).toBe(false);
      expect(result.error).toContain("User not found");
      expect(result.error).toContain("traceId:");
    });

    it("returns error response when user tries to follow themselves", async () => {
      vi.mocked(validateSessionToken).mockReturnValue({
        userId: "user-123",
        username: "viewer",
        role: "user",
      });

      vi.mocked(toggleFollow).mockRejectedValue(
        validationFailed("You cannot follow yourself"),
      );

      const result = await followsHandler.toggleFollow({
        sessionToken: "valid-token",
        username: "viewer",
      });

      expect(result.success).toBe(false);
      expect(result.following).toBe(false);
      expect(result.error).toContain("You cannot follow yourself");
    });
  });

  describe("getFollowStatus", () => {
    it("returns following status for authenticated user", async () => {
      vi.mocked(validateSessionToken).mockReturnValue({
        userId: "user-123",
        username: "viewer",
        role: "user",
      });

      vi.mocked(getFollowStatus).mockResolvedValue({ following: true });

      const result = await followsHandler.getFollowStatus({
        sessionToken: "valid-token",
        username: "targetuser",
      });

      expect(result.following).toBe(true);
      expect(getFollowStatus).toHaveBeenCalledWith("targetuser", "user-123");
    });

    it("returns false when user is not followed", async () => {
      vi.mocked(validateSessionToken).mockReturnValue({
        userId: "user-123",
        username: "viewer",
        role: "user",
      });

      vi.mocked(getFollowStatus).mockResolvedValue({ following: false });

      const result = await followsHandler.getFollowStatus({
        sessionToken: "valid-token",
        username: "targetuser",
      });

      expect(result.following).toBe(false);
    });

    it("throws unauthenticated for invalid session token", async () => {
      vi.mocked(validateSessionToken).mockImplementation(() => {
        throw unauthenticated("Invalid token");
      });

      await expect(
        followsHandler.getFollowStatus({
          sessionToken: "invalid-token",
          username: "targetuser",
        }),
      ).rejects.toThrow("Invalid token");

      expect(getFollowStatus).not.toHaveBeenCalled();
    });

    it("throws when target user is not found", async () => {
      vi.mocked(validateSessionToken).mockReturnValue({
        userId: "user-123",
        username: "viewer",
        role: "user",
      });

      vi.mocked(getFollowStatus).mockRejectedValue(notFound("User not found"));

      await expect(
        followsHandler.getFollowStatus({
          sessionToken: "valid-token",
          username: "missinguser",
        }),
      ).rejects.toThrow("User not found");
    });
  });

  describe("getFollowerCount", () => {
    it("returns follower count without authentication", async () => {
      vi.mocked(getFollowerCount).mockResolvedValue({ count: 12 });

      const result = await followsHandler.getFollowerCount({
        username: "targetuser",
      });

      expect(result.count).toBe(12);
      expect(validateSessionToken).not.toHaveBeenCalled();
      expect(getFollowerCount).toHaveBeenCalledWith("targetuser");
    });

    it("returns zero follower count", async () => {
      vi.mocked(getFollowerCount).mockResolvedValue({ count: 0 });

      const result = await followsHandler.getFollowerCount({
        username: "targetuser",
      });

      expect(result.count).toBe(0);
    });

    it("throws when user is not found", async () => {
      vi.mocked(getFollowerCount).mockRejectedValue(notFound("User not found"));

      await expect(
        followsHandler.getFollowerCount({
          username: "missinguser",
        }),
      ).rejects.toThrow("User not found");
    });
  });

  describe("getFollowingCount", () => {
    it("returns following count without authentication", async () => {
      vi.mocked(getFollowingCount).mockResolvedValue({ count: 7 });

      const result = await followsHandler.getFollowingCount({
        username: "targetuser",
      });

      expect(result.count).toBe(7);
      expect(validateSessionToken).not.toHaveBeenCalled();
      expect(getFollowingCount).toHaveBeenCalledWith("targetuser");
    });

    it("returns zero following count", async () => {
      vi.mocked(getFollowingCount).mockResolvedValue({ count: 0 });

      const result = await followsHandler.getFollowingCount({
        username: "targetuser",
      });

      expect(result.count).toBe(0);
    });

    it("throws when user is not found", async () => {
      vi.mocked(getFollowingCount).mockRejectedValue(
        notFound("User not found"),
      );

      await expect(
        followsHandler.getFollowingCount({
          username: "missinguser",
        }),
      ).rejects.toThrow("User not found");
    });
  });
});
