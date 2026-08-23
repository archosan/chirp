import {AsyncLocalStorage} from "async_hooks";

export interface RequestContext {
    traceId: string;
    service: string;
    method: string;
    userId?: string;
    startTime: number;
}

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(
    context: RequestContext,
    callback: () => Promise<T>
): Promise<T>{
    return requestContextStorage.run(context, callback);
}

export function getRequestContext(): RequestContext | undefined {
	return requestContextStorage.getStore();
}

export function setRequestUser(userId: string): void {
	const context = getRequestContext();
	if (context) {
		context.userId = userId;
	}
}