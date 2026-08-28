import { beforeEach, describe, expect, it, vi } from "vitest";

const { getRateLimitedCurrentUser, getPrisma, blockCourtSlot } = vi.hoisted(() => ({
  getRateLimitedCurrentUser: vi.fn(),
  getPrisma: vi.fn(),
  blockCourtSlot: vi.fn(),
}));

vi.mock("@/server/auth/current-user", () => ({
  getRateLimitedCurrentUser,
  AuthenticationError: class AuthenticationError extends Error {},
  AccountAccessError: class AccountAccessError extends Error {},
}));
vi.mock("@/server/db/prisma", () => ({ getPrisma }));
vi.mock("@/server/domain/court-slot-service", () => ({ blockCourtSlot }));

import { POST } from "./route";

const slotId = "e3e70682-c209-4cac-a29f-6fbed82c07cd";

describe("POST /api/v1/operator/slots/{slotId}/block", () => {
  beforeEach(() => {
    getRateLimitedCurrentUser.mockReset();
    getPrisma.mockReset();
    blockCourtSlot.mockReset();
  });

  it("uses the authenticated operator only when confirming a cancelled session slot", async () => {
    const prisma = { courtSlot: {} };
    getRateLimitedCurrentUser.mockResolvedValue({ id: "operator-user-id" });
    getPrisma.mockReturnValue(prisma);
    blockCourtSlot.mockResolvedValue({ id: slotId, status: "BLOCKED" });

    const response = await POST(new Request(`http://localhost/api/v1/operator/slots/${slotId}/block`, { method: "POST" }), { params: Promise.resolve({ slotId }) });

    expect(response.status).toBe(200);
    expect(blockCourtSlot).toHaveBeenCalledWith(prisma, { id: "operator-user-id" }, slotId);
  });

  it("rejects an invalid slot id before a state transition can run", async () => {
    getRateLimitedCurrentUser.mockResolvedValue({ id: "operator-user-id" });

    const response = await POST(new Request("http://localhost/api/v1/operator/slots/not-a-uuid/block", { method: "POST" }), { params: Promise.resolve({ slotId: "not-a-uuid" }) });

    expect(response.status).toBe(422);
    expect(blockCourtSlot).not.toHaveBeenCalled();
  });
});
