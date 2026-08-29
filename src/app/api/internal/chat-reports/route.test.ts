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

describe("GET /api/internal/chat-reports", () => {
  beforeEach(() => {
    getRateLimitedCurrentUser.mockReset();
    getPrisma.mockReset();
  });

  it("does not query reports for a member without internal-review authority", async () => {
    const findMany = vi.fn();
    getRateLimitedCurrentUser.mockResolvedValue({ id: "member-id", role: "MEMBER" });
    getPrisma.mockReturnValue({ matchChatReport: { findMany } });

    const response = await GET(new Request("http://localhost/api/internal/chat-reports"));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "INTERNAL_REVIEWER_REQUIRED" } });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("rejects an unknown report-status filter before reading internal data", async () => {
    const response = await GET(new Request("http://localhost/api/internal/chat-reports?status=OPENED"));

    expect(response.status).toBe(422);
    expect(getRateLimitedCurrentUser).not.toHaveBeenCalled();
  });
});
