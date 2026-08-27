// apps/api/src/grpc/handlers/likes.handler.ts

import type {
  ILikesService,
  LikeResponse,
  LikeStatusResponse,
} from "@chirp/proto";
import { validateSessionToken } from "../../middleware/auth";
import {
  getCommentLikeStatus,
  getPostLikeStatus,
  toggleCommentLike,
  togglePostLike,
} from "../../services/likes.service";
import { handleGrpcRequest } from "../handler-utils";

export const likesHandler: ILikesService = {
  async togglePostLike(request) {
    return handleGrpcRequest<LikeResponse>(
      { service: "LikesService", method: "TogglePostLike" },
      async () => {
        const auth = validateSessionToken(request.sessionToken);
        const result = await togglePostLike(request.postId, auth.userId);

        return {
          success: true,
          liked: result.liked,
        };
      },
      {
        errorResponse: (error, traceId) => ({
          success: false,
          liked: false,
          error: `${error.publicMessage} (traceId: ${traceId})`,
        }),
      },
    );
  },

  async toggleCommentLike(request) {
    return handleGrpcRequest<LikeResponse>(
      { service: "LikesService", method: "ToggleCommentLike" },
      async () => {
        const auth = validateSessionToken(request.sessionToken);
        const result = await toggleCommentLike(request.commentId, auth.userId);

        return {
          success: true,
          liked: result.liked,
        };
      },
      {
        errorResponse: (error, traceId) => ({
          success: false,
          liked: false,
          error: `${error.publicMessage} (traceId: ${traceId})`,
        }),
      },
    );
  },

  async getPostLikeStatus(request) {
    return handleGrpcRequest<LikeStatusResponse>(
      { service: "LikesService", method: "GetPostLikeStatus" },
      async () => {
        const auth = validateSessionToken(request.sessionToken);
        const result = await getPostLikeStatus(request.postId, auth.userId);

        return { liked: result.liked };
      },
    );
  },

  async getCommentLikeStatus(request) {
    return handleGrpcRequest<LikeStatusResponse>(
      { service: "LikesService", method: "GetCommentLikeStatus" },
      async () => {
        const auth = validateSessionToken(request.sessionToken);
        const result = await getCommentLikeStatus(
          request.commentId,
          auth.userId,
        );

        return { liked: result.liked };
      },
    );
  },
};
