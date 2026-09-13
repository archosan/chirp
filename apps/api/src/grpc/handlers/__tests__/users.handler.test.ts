import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usersHandler } from "../users.handler";

vi.mock("../../../services/users.service", () => ({
  getUser: vi.fn(),
  updateProfile: vi.fn(),
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
import { getUser, updateProfile } from "../../../services/users.service";
import { notFound, unauthenticated, validationFailed } from "../../../error";

describe("UsersHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  const authUser = {
    userId: "viewer-123",
    username: "viewer",
    role: "user" as const,
  };

  const mockUser = {
    id: "user-123",
    email: "test@example.com",
    username: "testuser",
    displayName: "Test User",
    avatarUrl: "https://example.com/avatar.png",
    bio: "Hello there",
    createdAt: new Date("2024-01-15T10:00:00Z"),
    followerCount: 10,
    followingCount: 5,
    postCount: 3,
    isFollowing: true,
    role: "user" as const,
  };

  describe("getUser", () => {
    it("returns user profile without authentication", async () => {
      vi.mocked(getUser).mockResolvedValue(mockUser);

      const result = await usersHandler.getUser({
        username: "testuser",
      });

      expect(result.id).toBe("user-123");
      expect(result.email).toBe("test@example.com");
      expect(result.username).toBe("testuser");
      expect(result.displayName).toBe("Test User");
      expect(result.avatarUrl).toBe("https://example.com/avatar.png");
      expect(result.bio).toBe("Hello there");
      expect(result.role).toBe("user");
      expect(result.followerCount).toBe(10);
      expect(result.followingCount).toBe(5);
      expect(result.postCount).toBe(3);
      expect(result.isFollowing).toBe(true);
      expect(result.createdAt).toBeDefined();

      expect(validateSessionToken).not.toHaveBeenCalled();
      expect(getUser).toHaveBeenCalledWith("testuser", undefined);
    });

    it("passes requester userId when optional session token is valid", async () => {
      vi.mocked(validateSessionToken).mockReturnValue(authUser);
      vi.mocked(getUser).mockResolvedValue(mockUser);

      const result = await usersHandler.getUser({
        username: "testuser",
        sessionToken: "valid-token",
      });

      expect(result.isFollowing).toBe(true);
      expect(validateSessionToken).toHaveBeenCalledWith("valid-token");
      expect(getUser).toHaveBeenCalledWith("testuser", "viewer-123");
    });

    it("ignores invalid optional token and loads profile anonymously", async () => {
      vi.mocked(validateSessionToken).mockImplementation(() => {
        throw unauthenticated("Invalid token");
      });

      vi.mocked(getUser).mockResolvedValue({
        ...mockUser,
        isFollowing: false,
        role: "user",
      });

      const result = await usersHandler.getUser({
        username: "testuser",
        sessionToken: "invalid-token",
      });

      expect(result.isFollowing).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith("auth.optional_token_invalid", {
        message: "Invalid token",
      });
      expect(getUser).toHaveBeenCalledWith("testuser", undefined);
    });

    it("maps missing optional profile fields to undefined", async () => {
      vi.mocked(getUser).mockResolvedValue({
        ...mockUser,
        avatarUrl: null,
        bio: null,
      });

      const result = await usersHandler.getUser({
        username: "testuser",
      });

      expect(result.avatarUrl).toBeUndefined();
      expect(result.bio).toBeUndefined();
    });

    it("throws when user is not found", async () => {
      vi.mocked(getUser).mockRejectedValue(notFound("User not found"));

      await expect(
        usersHandler.getUser({
          username: "missinguser",
        }),
      ).rejects.toThrow("User not found");
    });
  });

  describe("updateProfile", () => {
    it("updates profile for authenticated user", async () => {
      vi.mocked(validateSessionToken).mockReturnValue(authUser);
      vi.mocked(updateProfile).mockResolvedValue({ success: true });

      const result = await usersHandler.updateProfile({
        sessionToken: "valid-token",
        displayName: "Updated User",
        bio: "Updated bio",
        avatarUrl: "https://example.com/new-avatar.png",
      });

      expect(result.success).toBe(true);
      expect(updateProfile).toHaveBeenCalledWith({
        userId: "viewer-123",
        displayName: "Updated User",
        bio: "Updated bio",
        avatarUrl: "https://example.com/new-avatar.png",
      });
    });

    it("passes undefined for empty optional profile fields", async () => {
      vi.mocked(validateSessionToken).mockReturnValue(authUser);
      vi.mocked(updateProfile).mockResolvedValue({ success: true });

      const result = await usersHandler.updateProfile({
        sessionToken: "valid-token",
        displayName: "",
        bio: "",
        avatarUrl: "",
      });

      expect(result.success).toBe(true);
      expect(updateProfile).toHaveBeenCalledWith({
        userId: "viewer-123",
        displayName: undefined,
        bio: undefined,
        avatarUrl: undefined,
      });
    });

    it("returns error response for invalid session token", async () => {
      vi.mocked(validateSessionToken).mockImplementation(() => {
        throw unauthenticated("Invalid token");
      });

      const result = await usersHandler.updateProfile({
        sessionToken: "invalid-token",
        displayName: "Updated User",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid token");
      expect(result.error).toContain("traceId:");
      expect(updateProfile).not.toHaveBeenCalled();
    });

    it("returns error response when updateProfile fails validation", async () => {
      vi.mocked(validateSessionToken).mockReturnValue(authUser);
      vi.mocked(updateProfile).mockRejectedValue(
        validationFailed("Display name is too long"),
      );

      const result = await usersHandler.updateProfile({
        sessionToken: "valid-token",
        displayName: "a".repeat(100),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Display name is too long");
      expect(result.error).toContain("traceId:");
    });

    it("hides unknown update errors behind internal server error", async () => {
      vi.mocked(validateSessionToken).mockReturnValue(authUser);
      vi.mocked(updateProfile).mockRejectedValue(
        new Error("database exploded"),
      );

      const result = await usersHandler.updateProfile({
        sessionToken: "valid-token",
        displayName: "Updated User",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Internal server error");
      expect(result.error).toContain("traceId:");
      expect(result.error).not.toContain("database exploded");
    });
  });
});
