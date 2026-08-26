import type {
  ISearchService,
  PostResponse,
  PostsResponse,
  UsersResponse,
} from "@chirp/proto";
import { validateSessionToken } from "../../middleware/auth";
import { logger } from "../../observability/logger";
import { searchPosts, searchUsers } from "../../services/search.service";
import { toProtoTimestamp } from "../../services/utils";
import { handleGrpcRequest } from "../handler-utils";

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

export const searchHandler: ISearchService = {
  async searchPosts(request) {
    return handleGrpcRequest<PostsResponse>(
      { service: "SearchService", method: "SearchPosts" },
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

        const posts = await searchPosts(request.query, userId);

        return {
          posts: posts.map(toPostResponse),
        };
      },
    );
  },

  async searchUsers(request) {
    return handleGrpcRequest<UsersResponse>(
      { service: "SearchService", method: "SearchUsers" },
      async () => {
        const users = await searchUsers(request.query);

        return {
          users: users.map((user) => ({
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl || undefined,
            bio: user.bio || undefined,
          })),
        };
      },
    );
  },
};
