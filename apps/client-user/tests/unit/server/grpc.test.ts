import {describe, it, expect, vi} from "vitest";

vi.mock("../../../src/lib/session.server", () => ({
	getSessionData: vi.fn(),
}));

import {getSessionData} from '../../../src/lib/session.server';
import {getGrpcSessionToken } from '../../../src/lib/grpc.server';


describe("gRPC Session Token", () => {

    it("returns the API-issued session token from the session data", async () => {

        vi.mocked(getSessionData).mockResolvedValue({
            userId: "user-123",
            username: "testuser",
            sessionToken: "session-token-123",
        });

        await expect(getGrpcSessionToken()).resolves.toBe("session-token-123");

    });


});