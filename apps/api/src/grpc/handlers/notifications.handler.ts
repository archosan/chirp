import type {
  DeleteNotificationResponse,
  GetNotificationsResponse,
  GetUnreadCountResponse,
  INotificationsService,
  MarkAllAsReadResponse,
  MarkAsReadResponse,
} from "@chirp/proto";
import { validateSessionToken } from "../../middleware/auth";
import {
  deleteNotification,
  getUnreadCount,
  getUserNotifications,
  markAllAsRead,
  markAsRead,
} from "../../services/notifications.service";
import { toProtoTimestamp } from "../../services/utils";
import { handleGrpcRequest } from "../handler-utils";

export const notificationsHandler: INotificationsService = {
  async getNotifications(request) {
    return handleGrpcRequest<GetNotificationsResponse>(
      { service: "NotificationsService", method: "GetNotifications" },
      async () => {
        const auth = validateSessionToken(request.sessionToken);
        const notifications = await getUserNotifications(
          auth.userId,
          request.limit || 20,
          request.offset || 0,
        );

        return {
          notifications: notifications.map((n) => ({
            id: n.id,
            type: n.type,
            read: n.read,
            actor: n.actor
              ? {
                  id: n.actor.id,
                  username: n.actor.username,
                  displayName: n.actor.displayName,
                  avatarUrl: n.actor.avatarUrl || undefined,
                }
              : undefined,
            postId: n.postId || undefined,
            commentId: n.commentId || undefined,
            postContent: n.postContent || undefined,
            commentContent: n.commentContent || undefined,
            createdAt: toProtoTimestamp(n.createdAt),
          })),
        };
      },
    );
  },

  async getUnreadCount(request) {
    return handleGrpcRequest<GetUnreadCountResponse>(
      { service: "NotificationsService", method: "GetUnreadCount" },
      async () => {
        const auth = validateSessionToken(request.sessionToken);
        const result = await getUnreadCount(auth.userId);

        return { count: result.count };
      },
    );
  },

  async markAsRead(request) {
    return handleGrpcRequest<MarkAsReadResponse>(
      { service: "NotificationsService", method: "MarkAsRead" },
      async () => {
        const auth = validateSessionToken(request.sessionToken);
        await markAsRead(request.notificationId, auth.userId);

        return { success: true };
      },
      {
        errorResponse: (error, traceId) => ({
          success: false,
          error: `${error.publicMessage} (traceId: ${traceId})`,
        }),
      },
    );
  },

  async markAllAsRead(request) {
    return handleGrpcRequest<MarkAllAsReadResponse>(
      { service: "NotificationsService", method: "MarkAllAsRead" },
      async () => {
        const auth = validateSessionToken(request.sessionToken);
        await markAllAsRead(auth.userId);

        return { success: true };
      },
      {
        errorResponse: (error, traceId) => ({
          success: false,
          error: `${error.publicMessage} (traceId: ${traceId})`,
        }),
      },
    );
  },

  async deleteNotification(request) {
    return handleGrpcRequest<DeleteNotificationResponse>(
      { service: "NotificationsService", method: "DeleteNotification" },
      async () => {
        const auth = validateSessionToken(request.sessionToken);
        await deleteNotification(request.notificationId, auth.userId);

        return { success: true };
      },
      {
        errorResponse: (error, traceId) => ({
          success: false,
          error: `${error.publicMessage} (traceId: ${traceId})`,
        }),
      },
    );
  },
};
