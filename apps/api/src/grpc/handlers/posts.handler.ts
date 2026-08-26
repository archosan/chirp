import type {
  CreatePostResponse,
  DeletePostResponse,
  IPostsService,
  PostResponse,
  PostsResponse,
  UpdatePostResponse,
} from "@chirp/proto";
import { validateSessionToken } from "../../middleware/auth";
import {
  createPost,
  deletePost,
  getPost,
  getPosts,
  getUserPosts,
  updatePost,
} from "../../services/posts.service";
import { toProtoTimestamp } from "../../services/utils";
import { handleGrpcRequest } from "../handler-utils";
import { error } from "console";
import { logger } from "../../observability/logger";

function toPostResponse(post: any): PostResponse {
  return {
    id: post.id,
    content: post.content,
    createdAt: toProtoTimestamp(post.createdAt),
    updatedAt: toProtoTimestamp(post.updatedAt),
    author: post.author
      ? {
          id: post.author.id || "",
          username: post.author.username || "",
          displayName: post.author.displayName || "",
          avatarUrl: post.author.avatarUrl || undefined,
        }
      : { id: "", username: "", displayName: "" },
    likeCount: post.likeCount || 0,
    commentCount: post.commentCount || 0,
    isLiked: post.isLiked || false,
  };
}

export const postsHandler: IPostsService = {
  async createPost(request) {
    return handleGrpcRequest<CreatePostResponse>(
      { service: "PostsService", method: "CreatePost" },
      async () => {
        const auth = validateSessionToken(request.sessionToken);
        const result = await createPost({
          content: request.content,
          authorId: auth.userId,
        });

        return {
          success: true,
          postId: result.postId,
        };
      },
      {
        errorResponse: (error, traceId) => ({
          success: false,
          postId: "",
          error: `${error.publicMessage} (traceId: ${traceId})`,
        }),
      },
    );
  },

  async getPost(request) {
    return handleGrpcRequest<PostResponse>(
      { service: "PostsService", method: "GetPost" },
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
                  : "Invalid optional token",
            });
          }
        }

        const post = await getPost(request.postId, userId);
        return toPostResponse(post);
      },
    );
  },

  async updatePost(request) {
    return handleGrpcRequest<UpdatePostResponse>(
      { service: "PostsService", method: "UpdatePost" },
      async () => {
        const auth = validateSessionToken(request.sessionToken);

        await updatePost({
          postId: request.postId,
          content: request.content,
          userId: auth.userId,
        });

        return {
          success: true,
          postId: request.postId,
        };
      },
      {
        errorResponse: (error, traceId) => ({
          success: false,
          error: `${error.publicMessage} (traceId: ${traceId})`,
        }),
      },
    );
  },

  async deletePost(request) {
    return handleGrpcRequest<DeletePostResponse>(
      { service: "PostsService", method: "DeletePost" },
      async () => {
        const auth = validateSessionToken(request.sessionToken);
        await deletePost(request.postId, auth.userId);

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
  async getPosts(request) {
    return handleGrpcRequest<PostsResponse>(
      { service: "PostsService", method: "GetPosts" },
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
                  : "Invalid optional token",
            });
          }
        }

        const posts = await getPosts({
          limit: request.pagination?.limit || 20,
          offset: request.pagination?.offset || 0,
          userId,
        });

        return {
          posts: posts.map(toPostResponse),
        };
      },
    );
  },

  async getUserPosts(request) {
    return handleGrpcRequest<PostsResponse>(
      { service: "PostsService", method: "GetUserPosts" },
      async () => {
        let userId: string | undefined;

        if (request.sessionToken) {
          try {
            const auth = validateSessionToken(request.sessionToken);
            userId = auth.userId;
          } catch (error) {
            logger.warn("auth.optional_token_invalid", {
              message:
                error instanceof Error
                  ? error.message
                  : "Invalid optional token",
            });
          }
        }

        const posts = await getUserPosts(request.username, userId);

        return {
          posts: posts.map(toPostResponse),
        };
      },
    );
  },
};
