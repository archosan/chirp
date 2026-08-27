import type {
  BookmarkResponse,
  BookmarkStatusResponse,
  IBookmarksService,
  PostResponse,
  PostsResponse,
} from "@chirp/proto";
import { validateSessionToken } from "../../middleware/auth";
import {
  getBookmarkedPosts,
  getBookmarkStatus,
  toggleBookmark,
} from "../../services/bookmarks.service";
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

export const bookmarksHandler: IBookmarksService = {
  async toggleBookmark(request) {
    return handleGrpcRequest<BookmarkResponse>(
      { service: "BookmarksService", method: "ToggleBookmark" },
      async () => {
        const auth = validateSessionToken(request.sessionToken);
        const result = await toggleBookmark(request.postId, auth.userId);

        return {
          success: true,
          bookmarked: result.bookmarked,
        };
      },
      {
        errorResponse: (error, traceId) => ({
          success: false,
          bookmarked: false,
          error: `${error.publicMessage} (traceId: ${traceId})`,
        }),
      },
    );
  },

  async getBookmarkStatus(request) {
    return handleGrpcRequest<BookmarkStatusResponse>(
      { service: "BookmarksService", method: "GetBookmarkStatus" },
      async () => {
        const auth = validateSessionToken(request.sessionToken);
        const result = await getBookmarkStatus(request.postId, auth.userId);

        return { bookmarked: result.bookmarked };
      },
    );
  },

  async getBookmarkedPosts(request) {
    return handleGrpcRequest<PostsResponse>(
      { service: "BookmarksService", method: "GetBookmarkedPosts" },
      async () => {
        const auth = validateSessionToken(request.sessionToken);
        const posts = await getBookmarkedPosts(
          auth.userId,
          auth.userId,
          request.limit || 20,
          request.offset || 0,
        );

        return {
          posts: posts.map(toPostResponse),
        };
      },
    );
  },
};
