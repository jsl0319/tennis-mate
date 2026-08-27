import { beforeEach, describe, expect, it, vi } from "vitest";

const { getRateLimitedCurrentUser, getPrisma, reportCourtSupplyIncident } = vi.hoisted(() => ({
  getRateLimitedCurrentUser: vi.fn(),
  getPrisma: vi.fn(),
  reportCourtSupplyIncident: vi.fn(),
}));

vi.mock("@/server/auth/current-user", () => ({
  getRateLimitedCurrentUser,
  AuthenticationError: class AuthenticationError extends Error {},
  AccountAccessError: class AccountAccessError extends Error {},
}));
vi.mock("@/server/db/prisma", () => ({ getPrisma }));
vi.mock("@/server/domain/court-slot-service", () => ({ reportCourtSupplyIncident }));

import { POST } from "./route";

const slotId = "e3e70682-c209-4cac-a29f-6fbed82c07cd";

describe("POST /api/v1/operator/slots/{slotId}/supply-incidents", () => {
  beforeEach(() => {
    getRateLimitedCurrentUser.mockReset(); getPrisma.mockReset(); reportCourtSupplyIncident.mockReset();
  });

  it("passes a safe incident code and the current authenticated operator only", async () => {
    const prisma = { courtSlot: {} };
    getRateLimitedCurrentUser.mockResolvedValue({ id: "operator-user-id" });
    getPrisma.mockReturnValue(prisma);
    reportCourtSupplyIncident.mockResolvedValue({ id: "incident-id", status: "REQUESTED", impact: "NONE" });

    const response = await POST(new Request(`http://localhost/api/v1/operator/slots/${slotId}/supply-incidents`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: "INFORMATION_REVIEW", expectedVersion: 4, matchId: "attacker-match-id" }) }), { params: Promise.resolve({ slotId }) });

    expect(response.status).toBe(200);
    expect(reportCourtSupplyIncident).toHaveBeenCalledWith(prisma, { id: "operator-user-id" }, slotId, { code: "INFORMATION_REVIEW", expectedVersion: 4 });
  });

  it("rejects unrecognised codes before any supply state transition", async () => {
    getRateLimitedCurrentUser.mockResolvedValue({ id: "operator-user-id" });

    const response = await POST(new Request(`http://localhost/api/v1/operator/slots/${slotId}/supply-incidents`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: "CHANGE_TIME", expectedVersion: 4 }) }), { params: Promise.resolve({ slotId }) });

    expect(response.status).toBe(422);
    expect(reportCourtSupplyIncident).not.toHaveBeenCalled();
  });
});
