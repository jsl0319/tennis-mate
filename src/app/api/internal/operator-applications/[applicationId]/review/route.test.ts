import { beforeEach, describe, expect, it, vi } from "vitest";

const { getRateLimitedCurrentUser, getPrisma, reviewOperatorApplication, toOperatorApplicationView } = vi.hoisted(() => ({
  getRateLimitedCurrentUser: vi.fn(),
  getPrisma: vi.fn(),
  reviewOperatorApplication: vi.fn(),
  toOperatorApplicationView: vi.fn(),
}));

vi.mock("@/server/auth/current-user", () => ({
  getRateLimitedCurrentUser,
  AuthenticationError: class AuthenticationError extends Error {},
  AccountAccessError: class AccountAccessError extends Error {},
}));
vi.mock("@/server/db/prisma", () => ({ getPrisma }));
vi.mock("@/server/domain/operator-application-service", () => ({ reviewOperatorApplication, toOperatorApplicationView }));

import { POST } from "./route";

const context = { params: Promise.resolve({ applicationId: "00000000-0000-4000-8000-000000000001" }) };

describe("POST /api/internal/operator-applications/{applicationId}/review", () => {
  beforeEach(() => {
    getRateLimitedCurrentUser.mockReset();
    getPrisma.mockReset();
    reviewOperatorApplication.mockReset();
    toOperatorApplicationView.mockReset();
  });

  it("validates the decision and reason-code combination before calling the service", async () => {
    const response = await POST(new Request("http://localhost/api/internal/operator-applications/application-id/review", {
      method: "POST",
      body: JSON.stringify({ decision: "APPROVE_PUBLISH", reasonCode: "VENUE_UNVERIFIED" }),
    }), context);

    expect(response.status).toBe(422);
    expect(reviewOperatorApplication).not.toHaveBeenCalled();
  });

  it("uses the authenticated reviewer and never a client supplied reviewer id", async () => {
    const prisma = {};
    const reviewer = { id: "reviewer-id", role: "INTERNAL_REVIEWER" };
    getRateLimitedCurrentUser.mockResolvedValue(reviewer);
    getPrisma.mockReturnValue(prisma);
    reviewOperatorApplication.mockResolvedValue({ id: "application-id" });
    toOperatorApplicationView.mockReturnValue({ id: "application-id", status: "PUBLISH_APPROVED" });

    const response = await POST(new Request("http://localhost/api/internal/operator-applications/application-id/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "APPROVE_PUBLISH", reasonCode: "MANUAL_VERIFIED", reviewerUserId: "attacker-id" }),
    }), context);

    expect(response.status).toBe(200);
    expect(reviewOperatorApplication).toHaveBeenCalledWith(prisma, reviewer, "00000000-0000-4000-8000-000000000001", expect.objectContaining({
      decision: "APPROVE_PUBLISH",
      reasonCode: "MANUAL_VERIFIED",
    }));
    await expect(response.json()).resolves.toEqual({ id: "application-id", status: "PUBLISH_APPROVED" });
  });
});
