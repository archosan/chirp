import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/lib/session.server", () => ({
	getAdminSessionData: vi.fn(),
}));

import { getAdminGrpcSessionToken } from "../../../src/lib/grpc.server";
import { getAdminSessionData } from "../../../src/lib/session.server";


describe("Admin gRPC Session Token", () => {
    
    it("returns the API-issued session token from the admin session data", async () => {
        
        		vi.mocked(getAdminSessionData).mockResolvedValue({
			userId: "admin-123",
			username: "admin",
			role: "admin",
			sessionToken: "api-issued-admin-token",
		});

		await expect(getAdminGrpcSessionToken()).resolves.toBe("api-issued-admin-token");

    })

});