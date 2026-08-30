import { beforeEach, describe, expect, it, vi } from "vitest";

const { createMatchChatImageUpload, getPrisma, getRateLimitedCurrentUser } = vi.hoisted(() => ({
  createMatchChatImageUpload: vi.fn(),
  getPrisma: vi.fn(),
  getRateLimitedCurrentUser: vi.fn(),
}));

vi.mock("@/server/auth/current-user", () => ({
  getRateLimitedCurrentUser,
  AuthenticationError: class AuthenticationError extends Error {},
  AccountAccessError: class AccountAccessError extends Error {},
}));
vi.mock("@/server/db/prisma", () => ({ getPrisma }));
vi.mock("@/server/domain/match-chat-image-service", () => ({ createMatchChatImageUpload }));

import { POST } from "./route";

const matchId = "10000000-0000-4000-8000-000000000001";

describe("POST /api/v1/matches/{matchId}/conversation/image-uploads", () => {
  beforeEach(() => {
    createMatchChatImageUpload.mockReset();
    getPrisma.mockReset();
    getRateLimitedCurrentUser.mockReset();
  });

  it("requires exactly one photo file before reaching private storage", async () => {
    getRateLimitedCurrentUser.mockResolvedValue({ id: "member-id" });
    getPrisma.mockReturnValue({});
    const response = await POST(new Request(`http://localhost/api/v1/matches/${matchId}/conversation/image-uploads`, { method: "POST", body: new FormData() }), { params: Promise.resolve({ matchId }) });
    expect(response.status).toBe(422);
    expect(createMatchChatImageUpload).not.toHaveBeenCalled();
  });

  it("does not accept a caller-supplied owner or conversation field", async () => {
    const form = new FormData();
    form.set("file", new File([new Uint8Array([0xff, 0xd8, 0xff])], "court.jpg", { type: "image/jpeg" }));
    form.set("ownerUserId", "attacker-id");
    getRateLimitedCurrentUser.mockResolvedValue({ id: "member-id" });
    getPrisma.mockReturnValue({});
    const response = await POST(new Request(`http://localhost/api/v1/matches/${matchId}/conversation/image-uploads`, { method: "POST", body: form }), { params: Promise.resolve({ matchId }) });
    expect(response.status).toBe(400);
    expect(createMatchChatImageUpload).not.toHaveBeenCalled();
  });

  it("uses only the authenticated room member and match route for an upload", async () => {
    const prisma = {};
    const form = new FormData();
    form.set("file", new File([new Uint8Array([0xff, 0xd8, 0xff])], "court.jpg", { type: "image/jpeg" }));
    getRateLimitedCurrentUser.mockResolvedValue({ id: "member-id" });
    getPrisma.mockReturnValue(prisma);
    createMatchChatImageUpload.mockResolvedValue({ id: "50000000-0000-4000-8000-000000000001" });

    const response = await POST(new Request(`http://localhost/api/v1/matches/${matchId}/conversation/image-uploads`, { method: "POST", body: form }), { params: Promise.resolve({ matchId }) });

    expect(response.status).toBe(201);
    expect(createMatchChatImageUpload).toHaveBeenCalledWith(prisma, "member-id", matchId, expect.objectContaining({ name: "court.jpg", type: "image/jpeg" }));
    await expect(response.json()).resolves.toEqual({ id: "50000000-0000-4000-8000-000000000001" });
  });
});
