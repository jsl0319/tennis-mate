import { beforeEach, describe, expect, it, vi } from "vitest";

const { getRateLimitedCurrentUser, getPrisma, suspendOperatorApplication } = vi.hoisted(() => ({
  getRateLimitedCurrentUser: vi.fn(),
  getPrisma: vi.fn(),
  suspendOperatorApplication: vi.fn(),
}));

vi.mock("@/server/auth/current-user", () => ({
  getRateLimitedCurrentUser,
  AuthenticationError: class AuthenticationError extends Error {},
  AccountAccessError: class AccountAccessError extends Error {},
}));
vi.mock("@/server/db/prisma", () => ({ getPrisma }));
vi.mock("@/server/domain/operator-publish-control-service", () => ({ suspendOperatorApplication }));

import { POST } from "./route";

const context = { params: Promise.resolve({ applicationId: "00000000-0000-4000-8000-000000000001" }) };

describe("POST /api/internal/operator-applications/[applicationId]/suspend", () => {
  beforeEach(() => {
    getRateLimitedCurrentUser.mockReset();
    getPrisma.mockReset();
    suspendOperatorApplication.mockReset();
  });

  it("validates the safe reason code before controlling publication", async () => {
    const response = await POST(new Request("http://localhost/api/internal/operator-applications/application-id/suspend", {
      method: "POST",
      body: JSON.stringify({ reasonCode: "FREE_TEXT" }),
    }), context);

    expect(response.status).toBe(422);
    expect(suspendOperatorApplication).not.toHaveBeenCalled();
  });

  it("uses the authenticated internal reviewer, not a client supplied reviewer", async () => {
    const reviewer = { id: "reviewer-id", role: "INTERNAL_REVIEWER" };
    const prisma = {};
    getRateLimitedCurrentUser.mockResolvedValue(reviewer);
    getPrisma.mockReturnValue(prisma);
    suspendOperatorApplication.mockResolvedValue({ application: { id: "application-id", status: "SUSPENDED" } });

    const response = await POST(new Request("http://localhost/api/internal/operator-applications/application-id/suspend", {
      method: "POST",
      body: JSON.stringify({ reasonCode: "SAFETY_REVIEW", reviewerUserId: "attacker-id" }),
    }), context);

    expect(response.status).toBe(200);
    expect(suspendOperatorApplication).toHaveBeenCalledWith(prisma, reviewer, "00000000-0000-4000-8000-000000000001", { reasonCode: "SAFETY_REVIEW" });
  });
});
