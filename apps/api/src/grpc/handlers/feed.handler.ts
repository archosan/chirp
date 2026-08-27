import type { IFeedService, PostResponse, PostsResponse } from "@chirp/proto";
import { validateSessionToken } from "../../middleware/auth";
import { getExploreFeed, getHomeFeed } from "../../services/feed.service";
import { toProtoTimestamp } from "../../services/utils";
import { handleGrpcRequest } from "../handler-utils";
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

export const feedHandler: IFeedService = {
  async getHomeFeed(request) {
    return handleGrpcRequest<PostsResponse>(
      { service: "FeedService", method: "GetHomeFeed" },
      async () => {
        const auth = validateSessionToken(request.sessionToken);
        const posts = await getHomeFeed(auth.userId, {
          limit: request.pagination?.limit || 20,
          offset: request.pagination?.offset || 0,
        });

        return {
          posts: posts.map(toPostResponse),
        };
      },
    );
  },

  async getExploreFeed(request) {
    return handleGrpcRequest<PostsResponse>(
      { service: "FeedService", method: "GetExploreFeed" },
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

        const posts = await getExploreFeed({
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
};
