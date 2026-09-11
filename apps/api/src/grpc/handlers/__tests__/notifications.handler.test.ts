import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notificationsHandler } from "../notifications.handler";

vi.mock("../../../services/notifications.service", () => ({
  getUserNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  deleteNotification: vi.fn(),
}));

vi.mock("../../../middleware/auth", () => ({
  validateSessionToken: vi.fn(),
}));

import { validateSessionToken } from "../../../middleware/auth";
import {
  deleteNotification,
  getUnreadCount,
  getUserNotifications,
  markAllAsRead,
  markAsRead,
} from "../../../services/notifications.service";
import { notFound, unauthenticated, validationFailed } from "../../../error";

describe("NotificationsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  const authUser = {
    userId: "user-123",
    username: "testuser",
    role: "user" as const,
  };

  describe("getNotifications", () => {
    it("returns notifications for authenticated user", async () => {
      vi.mocked(validateSessionToken).mockReturnValue(authUser);

      vi.mocked(getUserNotifications).mockResolvedValue([
        {
          id: "notification-1",
          type: "like",
          read: false,
          actor: {
            id: "actor-1",
            username: "actoruser",
            displayName: "Actor User",
            avatarUrl: "https://example.com/avatar.png",
          },
          postId: "post-1",
          commentId: null,
          postContent: "Post preview",
          commentContent: null,
          createdAt: new Date("2024-01-15T10:00:00Z"),
        },
      ]);

      const result = await notificationsHandler.getNotifications({
        sessionToken: "valid-token",
        limit: 10,
        offset: 20,
      });

      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0].id).toBe("notification-1");
      expect(result.notifications[0].type).toBe("like");
      expect(result.notifications[0].read).toBe(false);
      expect(result.notifications[0].actor?.username).toBe("actoruser");
      expect(result.notifications[0].actor?.avatarUrl).toBe(
        "https://example.com/avatar.png",
      );
      expect(result.notifications[0].postId).toBe("post-1");
      expect(result.notifications[0].postContent).toBe("Post preview");
      expect(result.notifications[0].commentId).toBeUndefined();
      expect(result.notifications[0].commentContent).toBeUndefined();
      expect(result.notifications[0].createdAt).toBeDefined();

      expect(getUserNotifications).toHaveBeenCalledWith("user-123", 10, 20);
    });

    it("uses default pagination when limit and offset are omitted", async () => {
      vi.mocked(validateSessionToken).mockReturnValue(authUser);
      vi.mocked(getUserNotifications).mockResolvedValue([]);

      const result = await notificationsHandler.getNotifications({
        sessionToken: "valid-token",
        limit: 20,
        offset: 0,
      });

      expect(result.notifications).toEqual([]);
      expect(getUserNotifications).toHaveBeenCalledWith("user-123", 20, 0);
    });

    it("maps missing optional fields to undefined", async () => {
      vi.mocked(validateSessionToken).mockReturnValue(authUser);

      vi.mocked(getUserNotifications).mockResolvedValue([
        {
          id: "notification-1",
          type: "follow",
          read: true,
          actor: null,
          postId: null,
          commentId: null,
          postContent: null,
          commentContent: null,
          createdAt: new Date("2024-01-15T10:00:00Z"),
        },
      ]);

      const result = await notificationsHandler.getNotifications({
        sessionToken: "valid-token",
        limit: 20,
        offset: 0,
      });

      expect(result.notifications[0].actor).toBeUndefined();
      expect(result.notifications[0].postId).toBeUndefined();
      expect(result.notifications[0].commentId).toBeUndefined();
      expect(result.notifications[0].postContent).toBeUndefined();
      expect(result.notifications[0].commentContent).toBeUndefined();
    });

    it("throws unauthenticated for invalid session token", async () => {
      vi.mocked(validateSessionToken).mockImplementation(() => {
        throw unauthenticated("Invalid token");
      });

      await expect(
        notificationsHandler.getNotifications({
          sessionToken: "invalid-token",
          limit: 10,
          offset: 0,
        }),
      ).rejects.toThrow("Invalid token");

      expect(getUserNotifications).not.toHaveBeenCalled();
    });
  });

  describe("getUnreadCount", () => {
    it("returns unread count for authenticated user", async () => {
      vi.mocked(validateSessionToken).mockReturnValue(authUser);
      vi.mocked(getUnreadCount).mockResolvedValue({ count: 5 });

      const result = await notificationsHandler.getUnreadCount({
        sessionToken: "valid-token",
      });

      expect(result.count).toBe(5);
      expect(getUnreadCount).toHaveBeenCalledWith("user-123");
    });

    it("throws unauthenticated for invalid session token", async () => {
      vi.mocked(validateSessionToken).mockImplementation(() => {
        throw unauthenticated("Invalid token");
      });

      await expect(
        notificationsHandler.getUnreadCount({
          sessionToken: "invalid-token",
        }),
      ).rejects.toThrow("Invalid token");

      expect(getUnreadCount).not.toHaveBeenCalled();
    });
  });

  describe("markAsRead", () => {
    it("marks notification as read", async () => {
      vi.mocked(validateSessionToken).mockReturnValue(authUser);
      vi.mocked(markAsRead).mockResolvedValue({ success: true });

      const result = await notificationsHandler.markAsRead({
        sessionToken: "valid-token",
        notificationId: "notification-1",
      });

      expect(result.success).toBe(true);
      expect(markAsRead).toHaveBeenCalledWith("notification-1", "user-123");
    });

    it("returns error response when notification is not found", async () => {
      vi.mocked(validateSessionToken).mockReturnValue(authUser);
      vi.mocked(markAsRead).mockRejectedValue(
        notFound("Notification not found"),
      );

      const result = await notificationsHandler.markAsRead({
        sessionToken: "valid-token",
        notificationId: "missing-notification",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Notification not found");
      expect(result.error).toContain("traceId:");
    });

    it("returns error response when user is unauthorized", async () => {
      vi.mocked(validateSessionToken).mockReturnValue(authUser);
      vi.mocked(markAsRead).mockRejectedValue(validationFailed("Unauthorized"));

      const result = await notificationsHandler.markAsRead({
        sessionToken: "valid-token",
        notificationId: "notification-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unauthorized");
    });

    it("returns error response for invalid session token", async () => {
      vi.mocked(validateSessionToken).mockImplementation(() => {
        throw unauthenticated("Invalid token");
      });

      const result = await notificationsHandler.markAsRead({
        sessionToken: "invalid-token",
        notificationId: "notification-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid token");
      expect(markAsRead).not.toHaveBeenCalled();
    });
  });

  describe("markAllAsRead", () => {
    it("marks all notifications as read", async () => {
      vi.mocked(validateSessionToken).mockReturnValue(authUser);
      vi.mocked(markAllAsRead).mockResolvedValue({ success: true });

      const result = await notificationsHandler.markAllAsRead({
        sessionToken: "valid-token",
      });

      expect(result.success).toBe(true);
      expect(markAllAsRead).toHaveBeenCalledWith("user-123");
    });

    it("returns error response for invalid session token", async () => {
      vi.mocked(validateSessionToken).mockImplementation(() => {
        throw unauthenticated("Invalid token");
      });

      const result = await notificationsHandler.markAllAsRead({
        sessionToken: "invalid-token",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid token");
      expect(markAllAsRead).not.toHaveBeenCalled();
    });
  });

  describe("deleteNotification", () => {
    it("deletes notification", async () => {
      vi.mocked(validateSessionToken).mockReturnValue(authUser);
      vi.mocked(deleteNotification).mockResolvedValue({ success: true });

      const result = await notificationsHandler.deleteNotification({
        sessionToken: "valid-token",
        notificationId: "notification-1",
      });

      expect(result.success).toBe(true);
      expect(deleteNotification).toHaveBeenCalledWith(
        "notification-1",
        "user-123",
      );
    });

    it("returns error response when notification is not found", async () => {
      vi.mocked(validateSessionToken).mockReturnValue(authUser);
      vi.mocked(deleteNotification).mockRejectedValue(
        notFound("Notification not found"),
      );

      const result = await notificationsHandler.deleteNotification({
        sessionToken: "valid-token",
        notificationId: "missing-notification",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Notification not found");
      expect(result.error).toContain("traceId:");
    });

    it("returns error response when user is unauthorized", async () => {
      vi.mocked(validateSessionToken).mockReturnValue(authUser);
      vi.mocked(deleteNotification).mockRejectedValue(
        validationFailed("Unauthorized"),
      );

      const result = await notificationsHandler.deleteNotification({
        sessionToken: "valid-token",
        notificationId: "notification-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unauthorized");
    });
  });
});
