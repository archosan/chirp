import type {
  IUsersService,
  UpdateProfileResponse,
  UserProfileResponse,
} from "@chirp/proto";
import { validateSessionToken } from "../../middleware/auth";
import { logger } from "../../observability/logger";
import { getUser, updateProfile } from "../../services/users.service";
import { toProtoTimestamp } from "../../services/utils";
import { handleGrpcRequest } from "../handler-utils";

export const usersHandler: IUsersService = {
  async getUser(request) {
    return handleGrpcRequest<UserProfileResponse>(
      { service: "UsersService", method: "GetUser" },
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

        const user = await getUser(request.username, userId);

        return {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl || undefined,
          bio: user.bio || undefined,
          role: user.role,
          createdAt: toProtoTimestamp(user.createdAt),
          followerCount: user.followerCount,
          followingCount: user.followingCount,
          postCount: user.postCount,
          isFollowing: user.isFollowing,
        };
      },
    );
  },

  async updateProfile(request) {
    return handleGrpcRequest<UpdateProfileResponse>(
      { service: "UsersService", method: "UpdateProfile" },
      async () => {
        const auth = validateSessionToken(request.sessionToken);

        await updateProfile({
          userId: auth.userId,
          displayName: request.displayName || undefined,
          bio: request.bio || undefined,
          avatarUrl: request.avatarUrl || undefined,
        });

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
