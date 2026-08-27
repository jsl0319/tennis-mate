import { beforeEach, describe, expect, it, vi } from "vitest";

const { getRateLimitedCurrentUser, getPrisma, getOnboardedViewer, getPublicCourtSlot } = vi.hoisted(() => ({
  getRateLimitedCurrentUser: vi.fn(),
  getPrisma: vi.fn(),
  getOnboardedViewer: vi.fn(),
  getPublicCourtSlot: vi.fn(),
}));

vi.mock("@/server/auth/current-user", () => ({
  getRateLimitedCurrentUser,
  AuthenticationError: class AuthenticationError extends Error {},
  AccountAccessError: class AccountAccessError extends Error {},
}));
vi.mock("@/server/db/prisma", () => ({ getPrisma }));
vi.mock("@/server/domain/match-service", () => ({ getOnboardedViewer }));
vi.mock("@/server/domain/court-slot-service", () => ({ getPublicCourtSlot }));

import { GET } from "./route";

const slotId = "e3e70682-c209-4cac-a29f-6fbed82c07cd";

describe("GET /api/v1/partner-session-slots/{slotId}", () => {
  beforeEach(() => {
    getRateLimitedCurrentUser.mockReset();
    getPrisma.mockReset();
    getOnboardedViewer.mockReset();
    getPublicCourtSlot.mockReset();
  });

  it("requires an onboarded viewer before returning a public slot", async () => {
    const prisma = { courtSlot: {} };
    getRateLimitedCurrentUser.mockResolvedValue({ id: "member-id", onboardingCompletedAt: new Date() });
    getPrisma.mockReturnValue(prisma);
    getOnboardedViewer.mockResolvedValue({ id: "member-id" });
    getPublicCourtSlot.mockResolvedValue({ id: slotId, status: "AVAILABLE" });

    const response = await GET(new Request(`http://localhost/api/v1/partner-session-slots/${slotId}`), { params: Promise.resolve({ slotId }) });

    expect(response.status).toBe(200);
    expect(getOnboardedViewer).toHaveBeenCalledWith(prisma, { id: "member-id", onboardingCompletedAt: expect.any(Date) });
    expect(getPublicCourtSlot).toHaveBeenCalledWith(prisma, slotId);
  });

  it("rejects a malformed slot identifier before the domain lookup", async () => {
    getRateLimitedCurrentUser.mockResolvedValue({ id: "member-id", onboardingCompletedAt: new Date() });
    getPrisma.mockReturnValue({ courtSlot: {} });
    getOnboardedViewer.mockResolvedValue({ id: "member-id" });

    const response = await GET(new Request("http://localhost/api/v1/partner-session-slots/not-a-uuid"), { params: Promise.resolve({ slotId: "not-a-uuid" }) });

    expect(response.status).toBe(422);
    expect(getPublicCourtSlot).not.toHaveBeenCalled();
  });
});
