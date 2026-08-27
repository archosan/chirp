import type {
  CommentResponse,
  CommentsResponse,
  CreateCommentResponse,
  DeleteCommentResponse,
  ICommentsService,
} from "@chirp/proto";
import { validateSessionToken } from "../../middleware/auth";
import {
  createComment,
  deleteComment,
  getPostComments,
} from "../../services/comments.service";
import { toProtoTimestamp } from "../../services/utils";
import { handleGrpcRequest } from "../handler-utils";
import { error } from "console";
import { logger } from "../../observability/logger";

function toCommentResponse(comment: any): CommentResponse {
  return {
    id: comment.id,
    content: comment.content,
    createdAt: toProtoTimestamp(comment.createdAt),
    parentId: comment.parentId || undefined,
    author: comment.author
      ? {
          id: comment.author.id || "",
          username: comment.author.username || "",
          displayName: comment.author.displayName || "",
          avatarUrl: comment.author.avatarUrl || undefined,
        }
      : { id: "", username: "", displayName: "" },
    likeCount: comment.likeCount || 0,
    isLiked: comment.isLiked || false,
    replies: (comment.replies || []).map(toCommentResponse),
  };
}

export const commentsHandler: ICommentsService = {
  async createComment(request) {
    return handleGrpcRequest<CreateCommentResponse>(
      { service: "CommentsService", method: "CreateComment" },
      async () => {
        const auth = validateSessionToken(request.sessionToken);
        const result = await createComment({
          postId: request.postId,
          content: request.content,
          authorId: auth.userId,
          parentId: request.parentId || undefined,
        });

        return {
          success: true,
          commentId: result.commentId,
        };
      },
      {
        errorResponse: (error, traceId) => ({
          success: false,
          commentId: "",
          error: `${error instanceof Error ? error.message : "Failed to create comment"} (traceId: ${traceId})`,
        }),
      },
    );
  },

  async getPostComments(request) {
    return handleGrpcRequest<CommentsResponse>(
      { service: "CommentsService", method: "GetPostComments" },
      async () => {
        let userId: string | undefined;

        if (request.sessionToken) {
          try {
            const auth = validateSessionToken(request.sessionToken);
            userId = auth.userId;
          } catch {
            logger.warn("auth.optional_token_invalid", {
              message:
                error instanceof Error
                  ? error.message
                  : "Failed to validate session token",
            });
          }
        }

        const comments = await getPostComments(request.postId, userId);

        return {
          comments: comments.map(toCommentResponse),
        };
      },
    );
  },

  async deleteComment(request) {
    return handleGrpcRequest<DeleteCommentResponse>(
      { service: "CommentsService", method: "DeleteComment" },
      async () => {
        const auth = validateSessionToken(request.sessionToken);
        await deleteComment(request.commentId, auth.userId);

        return { success: true };
      },
      {
        errorResponse: (error, traceId) => ({
          success: false,
          error: `${error instanceof Error ? error.message : "Failed to delete comment"} (traceId: ${traceId})`,
        }),
      },
    );
  },
};
