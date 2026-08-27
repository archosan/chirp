import type {
  CountResponse,
  FollowResponse,
  FollowStatusResponse,
  IFollowsService,
} from "@chirp/proto";
import { validateSessionToken } from "../../middleware/auth";
import {
  getFollowerCount,
  getFollowingCount,
  getFollowStatus,
  toggleFollow,
} from "../../services/follows.service";
import { handleGrpcRequest } from "../handler-utils";

export const followsHandler: IFollowsService = {
  async toggleFollow(request) {
    return handleGrpcRequest<FollowResponse>(
      { service: "FollowsService", method: "ToggleFollow" },
      async () => {
        const auth = validateSessionToken(request.sessionToken);
        const result = await toggleFollow(request.username, auth.userId);

        return {
          success: true,
          following: result.following,
        };
      },
      {
        errorResponse: (error, traceId) => ({
          success: false,
          following: false,
          error: `${error.publicMessage} (traceId: ${traceId})`,
        }),
      },
    );
  },

  async getFollowStatus(request) {
    return handleGrpcRequest<FollowStatusResponse>(
      { service: "FollowsService", method: "GetFollowStatus" },
      async () => {
        const auth = validateSessionToken(request.sessionToken);
        const result = await getFollowStatus(request.username, auth.userId);

        return { following: result.following };
      },
    );
  },

  async getFollowerCount(request) {
    return handleGrpcRequest<CountResponse>(
      { service: "FollowsService", method: "GetFollowerCount" },
      async () => {
        const result = await getFollowerCount(request.username);
        return { count: result.count };
      },
    );
  },

  async getFollowingCount(request) {
    return handleGrpcRequest<CountResponse>(
      { service: "FollowsService", method: "GetFollowingCount" },
      async () => {
        const result = await getFollowingCount(request.username);
        return { count: result.count };
      },
    );
  },
};
