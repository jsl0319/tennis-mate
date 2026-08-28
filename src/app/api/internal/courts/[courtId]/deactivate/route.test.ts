import { beforeEach, describe, expect, it, vi } from "vitest";

const { deactivateCourt, getRateLimitedCurrentUser, getPrisma } = vi.hoisted(() => ({
  deactivateCourt: vi.fn(),
  getRateLimitedCurrentUser: vi.fn(),
  getPrisma: vi.fn(),
}));

vi.mock("@/server/auth/current-user", () => ({
  getRateLimitedCurrentUser,
  AuthenticationError: class AuthenticationError extends Error {},
  AccountAccessError: class AccountAccessError extends Error {},
}));
vi.mock("@/server/db/prisma", () => ({ getPrisma }));
vi.mock("@/server/domain/operator-publish-control-service", () => ({ deactivateCourt }));

import { POST } from "./route";

const context = { params: Promise.resolve({ courtId: "00000000-0000-4000-8000-000000000002" }) };

describe("POST /api/internal/courts/[courtId]/deactivate", () => {
  beforeEach(() => {
    deactivateCourt.mockReset();
    getRateLimitedCurrentUser.mockReset();
    getPrisma.mockReset();
  });

  it("rejects an arbitrary reason before it reaches the court service", async () => {
    const response = await POST(new Request("http://localhost/api/internal/courts/court-id/deactivate", {
      method: "POST",
      body: JSON.stringify({ reasonCode: "please disable this" }),
    }), context);

    expect(response.status).toBe(422);
    expect(deactivateCourt).not.toHaveBeenCalled();
  });

  it("passes only the authenticated reviewer and selected reason to the court service", async () => {
    const reviewer = { id: "reviewer-id", role: "INTERNAL_REVIEWER" };
    const prisma = {};
    getRateLimitedCurrentUser.mockResolvedValue(reviewer);
    getPrisma.mockReturnValue(prisma);
    deactivateCourt.mockResolvedValue({ court: { id: "court-id", status: "INACTIVE" } });

    const response = await POST(new Request("http://localhost/api/internal/courts/court-id/deactivate", {
      method: "POST",
      body: JSON.stringify({ reasonCode: "VENUE_CLOSED", reviewerUserId: "attacker-id" }),
    }), context);

    expect(response.status).toBe(200);
    expect(deactivateCourt).toHaveBeenCalledWith(prisma, reviewer, "00000000-0000-4000-8000-000000000002", { reasonCode: "VENUE_CLOSED" });
  });
});
