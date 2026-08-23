type AppErrorCode =
	| "UNAUTHENTICATED"
	| "PERMISSION_DENIED"
	| "NOT_FOUND"
	| "VALIDATION_FAILED"
	| "CONFLICT"
	| "FAILED_PRECONDITION"
	| "INTERNAL";

import { status } from "@grpc/grpc-js";

export class AppError extends Error {
	readonly code: AppErrorCode;
	readonly grpcStatus: status;
	readonly publicMessage: string;
	readonly details?: Record<string, unknown>;

	constructor(
		code: AppErrorCode,
		publicMessage: string,
		grpcStatus: status,
		details?: Record<string, unknown>
	) {
		super(publicMessage);
		this.name = "AppError";
		this.code = code;
		this.grpcStatus = grpcStatus
		this.publicMessage = publicMessage;
		this.details = details;
	}

}

export function unauthenticated(message = "Authentication required", details?: Record<string, unknown>) {
	return new AppError("UNAUTHENTICATED", message, status.UNAUTHENTICATED, details);
}

export function permissionDenied(message = "Permission denied", details?: Record<string, unknown>) {
	return new AppError("PERMISSION_DENIED", message, status.PERMISSION_DENIED, details);
}

export function notFound(message = "Resource not found", details?: Record<string, unknown>) {
	return new AppError("NOT_FOUND", message, status.NOT_FOUND, details);
}

export function validationFailed(message = "Invalid request", details?: Record<string, unknown>) {
	return new AppError("VALIDATION_FAILED", message, status.INVALID_ARGUMENT, details);
}

export function conflict(message = "Resource already exists", details?: Record<string, unknown>) {
	return new AppError("CONFLICT", message, status.ALREADY_EXISTS, details);
}

export function failedPrecondition(message = "Operation cannot be completed", details?: Record<string, unknown>) {
	return new AppError("FAILED_PRECONDITION", message, status.FAILED_PRECONDITION, details);
}

export function internalError(message = "Internal server error", details?: Record<string, unknown>) {
	return new AppError("INTERNAL", message, status.INTERNAL, details);
}

export function toAppError(error: unknown): AppError {
		if (error instanceof AppError) {
		return error;
	}

	if (error instanceof Error) {
		return internalError("Internal server error", {
			cause: error.message,
			stack: error.stack,
		});
	}

	return internalError("Internal server error", {
		cause: String(error),
	});
}