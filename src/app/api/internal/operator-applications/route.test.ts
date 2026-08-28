import { beforeEach, describe, expect, it, vi } from "vitest";

const { getRateLimitedCurrentUser, getPrisma } = vi.hoisted(() => ({
  getRateLimitedCurrentUser: vi.fn(),
  getPrisma: vi.fn(),
}));

vi.mock("@/server/auth/current-user", () => ({
  getRateLimitedCurrentUser,
  AuthenticationError: class AuthenticationError extends Error {},
  AccountAccessError: class AccountAccessError extends Error {},
}));
vi.mock("@/server/db/prisma", () => ({ getPrisma }));

import { GET } from "./route";

describe("GET /api/internal/operator-applications", () => {
  beforeEach(() => {
    getRateLimitedCurrentUser.mockReset();
    getPrisma.mockReset();
  });

  it("rejects a member before reading internal applications", async () => {
    const findMany = vi.fn();
    getRateLimitedCurrentUser.mockResolvedValue({ id: "member-id", role: "MEMBER" });
    getPrisma.mockReturnValue({ courtOperatorApplication: { findMany } });

    const response = await GET(new Request("http://localhost/api/internal/operator-applications"));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "INTERNAL_REVIEWER_REQUIRED" } });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("validates the fixed pending-review status query", async () => {
    const response = await GET(new Request("http://localhost/api/internal/operator-applications?status=PUBLISH_APPROVED"));

    expect(response.status).toBe(422);
    expect(getRateLimitedCurrentUser).not.toHaveBeenCalled();
  });
});
