import { randomUUID } from "crypto";
import { Metadata, status } from "@grpc/grpc-js";
import { AppError, toAppError } from "../../src/error";
import { runWithRequestContext } from "../observability/context";
import { logger } from "../observability/logger";

interface HandlerInfo {
  service: string;
  method: string;
}

interface HandleGrpcOptions<TResponse> {
  errorResponse?: (error: AppError, traceId: string) => TResponse;
}

export async function handleGrpcRequest<TResponse>(
  info: HandlerInfo,
  handler: () => Promise<TResponse>,
  options: HandleGrpcOptions<TResponse> = {},
): Promise<TResponse> {
  const traceId = randomUUID();

  return runWithRequestContext(
    {
      traceId,
      service: info.service,
      method: info.method,
      startTime: Date.now(),
    },
    async () => {
      const startedAt = Date.now();

      logger.info("grpc.request.start");

      try {
        const response = await handler();

        logger.info("grpc.request.success", {
          durationMs: Date.now() - startedAt,
        });

        return response;
      } catch (error) {
        const appError = toAppError(error);

        logger.error("grpc.request.error", {
          durationMs: Date.now() - startedAt,
          errorCode: appError.code,
          grpcStatus: appError.grpcStatus,
          message: appError.publicMessage,
          details: appError.details,
        });

        if (options.errorResponse) {
          return options.errorResponse(appError, traceId);
        }

        throw toGrpcError(appError, traceId);
      }
    },
  );
}

export function toGrpcError(error: AppError, traceId: string): Error {
  const grpcError = new Error(
    `${error.publicMessage} (traceId: ${traceId})`,
  ) as Error & {
    code: status;
    metadata: Metadata;
  };

  grpcError.code = error.grpcStatus;

  const metadata = new Metadata();
  metadata.set("x-trace-id", traceId);
  metadata.set("x-error-code", error.code);

  grpcError.metadata = metadata;

  return grpcError;
}
