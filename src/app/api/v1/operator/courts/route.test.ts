import { beforeEach, describe, expect, it, vi } from "vitest";

const { getRateLimitedCurrentUser, getPrisma, createCourt, getMyCourts } = vi.hoisted(() => ({
  getRateLimitedCurrentUser: vi.fn(),
  getPrisma: vi.fn(),
  createCourt: vi.fn(),
  getMyCourts: vi.fn(),
}));

vi.mock("@/server/auth/current-user", () => ({
  getRateLimitedCurrentUser,
  AuthenticationError: class AuthenticationError extends Error {},
  AccountAccessError: class AccountAccessError extends Error {},
}));
vi.mock("@/server/db/prisma", () => ({ getPrisma }));
vi.mock("@/server/domain/court-slot-service", () => ({ createCourt, getMyCourts }));

import { POST } from "./route";

describe("POST /api/v1/operator/courts", () => {
  beforeEach(() => {
    getRateLimitedCurrentUser.mockReset();
    getPrisma.mockReset();
    createCourt.mockReset();
    getMyCourts.mockReset();
  });

  it("uses the authenticated operator and validates the facility region", async () => {
    const prisma = { court: {} };
    getRateLimitedCurrentUser.mockResolvedValue({ id: "session-user-id" });
    getPrisma.mockReturnValue(prisma);
    createCourt.mockResolvedValue({ id: "court-id" });

    const response = await POST(new Request("http://localhost/api/v1/operator/courts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regionCode: "SEOUL-001", ownerUserId: "attacker-id" }),
    }));

    expect(response.status).toBe(201);
    expect(createCourt).toHaveBeenCalledWith(prisma, { id: "session-user-id" }, { regionCode: "SEOUL-001" });
  });

  it("does not call the service when the region is missing", async () => {
    getRateLimitedCurrentUser.mockResolvedValue({ id: "session-user-id" });

    const response = await POST(new Request("http://localhost/api/v1/operator/courts", {
      method: "POST",
      body: JSON.stringify({}),
    }));

    expect(response.status).toBe(422);
    expect(createCourt).not.toHaveBeenCalled();
  });
});
