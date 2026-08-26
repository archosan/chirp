import { vi } from "vitest";
import type {
  AuthResponse,
  IAuthService,
  UserResponse,
  ValidateSessionResponse,
} from "@chirp/proto";
import { validateSessionToken } from "../../middleware/auth";
import {
  getCurrentUser,
  loginUser,
  registerUser,
} from "../../services/auth.service";
import { toProtoTimestamp } from "../../services/utils";
import { handleGrpcRequest } from "../handler-utils";
import { logger } from "../../observability/logger";

export const authHandler: IAuthService = {
  async register(request) {
    return handleGrpcRequest<AuthResponse>(
      { service: "AuthService", method: "Register" },
      async () => {
        const result = await registerUser({
          email: request.email,
          username: request.username,
          displayName: request.displayName,
          password: request.password,
        });

        return {
          success: true,
          userId: result.userId,
          sessionToken: result.sessionToken,
        };
      },
      {
        errorResponse: (error, traceId) => ({
          success: false,
          userId: "",
          sessionToken: "",
          error: `${error.publicMessage} (traceId: ${traceId})`,
        }),
      },
    );
  },

  async login(request) {
    return handleGrpcRequest<AuthResponse>(
      { service: "AuthService", method: "Login" },
      async () => {
        const result = await loginUser({
          email: request.email,
          password: request.password,
        });

        return {
          success: true,
          userId: result.userId,
          sessionToken: result.sessionToken,
        };
      },
      {
        errorResponse: (error, traceId) => ({
          success: false,
          userId: "",
          sessionToken: "",
          error: `${error.publicMessage} (traceId: ${traceId})`,
        }),
      },
    );
  },

  async logout(_request) {
    return handleGrpcRequest<{ success: boolean }>(
      { service: "AuthService", method: "Logout" },
      async () => {
        // Since we're using stateless JWTs, there's no server-side session to invalidate.
        // The client should simply discard the token on logout.
        return { success: true };
      },
    );
  },

  async getCurrentUser(request) {
    return handleGrpcRequest<UserResponse>(
      { service: "AuthService", method: "GetCurrentUser" },
      async () => {
        const auth = validateSessionToken(request.sessionToken);
        const user = await getCurrentUser(auth.userId);

        return {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl || undefined,
          bio: user.bio || undefined,
          role: user.role,
          createdAt: toProtoTimestamp(user.createdAt),
        };
      },
    );
  },

  async validateSession(request) {
    return handleGrpcRequest<ValidateSessionResponse>(
      { service: "AuthService", method: "ValidateSession" },
      async () => {
        try {
          const auth = validateSessionToken(request.sessionToken);
          return {
            valid: true,
            userId: auth.userId,
            username: auth.username,
            role: auth.role,
          };
        } catch (error) {
          logger.warn("auth.session_invalid", {
            message: error instanceof Error ? error.message : "Invalid session",
          });

          return {
            valid: false,
            userId: "",
            username: "",
            role: "",
          };
        }
      },
    );
  },
};
