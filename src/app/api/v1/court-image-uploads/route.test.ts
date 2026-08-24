import { beforeEach, describe, expect, it, vi } from "vitest";

const { createCourtImageUpload, getOnboardedViewer, getPrisma, getRateLimitedCurrentUser } = vi.hoisted(() => ({
  createCourtImageUpload: vi.fn(),
  getOnboardedViewer: vi.fn(),
  getPrisma: vi.fn(),
  getRateLimitedCurrentUser: vi.fn(),
}));

vi.mock("@/server/auth/current-user", () => ({
  getRateLimitedCurrentUser,
  AuthenticationError: class AuthenticationError extends Error {},
  AccountAccessError: class AccountAccessError extends Error {},
}));
vi.mock("@/server/db/prisma", () => ({ getPrisma }));
vi.mock("@/server/domain/court-image-service", () => ({ createCourtImageUpload }));
vi.mock("@/server/domain/match-service", () => ({ getOnboardedViewer }));

import { POST } from "./route";

describe("POST /api/v1/court-image-uploads", () => {
  beforeEach(() => {
    createCourtImageUpload.mockReset();
    getOnboardedViewer.mockReset();
    getPrisma.mockReset();
    getRateLimitedCurrentUser.mockReset();
  });

  it("requires a file before it reaches object storage", async () => {
    getRateLimitedCurrentUser.mockResolvedValue({ id: "user-id" });
    getPrisma.mockReturnValue({});
    getOnboardedViewer.mockResolvedValue({ id: "user-id" });

    const response = await POST(new Request("http://localhost/api/v1/court-image-uploads", { method: "POST", body: new FormData() }));

    expect(response.status).toBe(422);
    expect(createCourtImageUpload).not.toHaveBeenCalled();
  });

  it("accepts exactly one file", async () => {
    const form = new FormData();
    form.append("file", new File([new Uint8Array([0xff, 0xd8, 0xff])], "one.jpg", { type: "image/jpeg" }));
    form.append("file", new File([new Uint8Array([0xff, 0xd8, 0xff])], "two.jpg", { type: "image/jpeg" }));
    getRateLimitedCurrentUser.mockResolvedValue({ id: "user-id" });
    getPrisma.mockReturnValue({});
    getOnboardedViewer.mockResolvedValue({ id: "user-id" });

    const response = await POST(new Request("http://localhost/api/v1/court-image-uploads", { method: "POST", body: form }));

    expect(response.status).toBe(422);
    expect(createCourtImageUpload).not.toHaveBeenCalled();
  });

  it("rejects a client-supplied ownership field", async () => {
    const prisma = {};
    const form = new FormData();
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], "court.jpg", { type: "image/jpeg" });
    form.set("file", file);
    form.set("ownerUserId", "attacker-id");
    getRateLimitedCurrentUser.mockResolvedValue({ id: "session-user-id" });
    getPrisma.mockReturnValue(prisma);
    getOnboardedViewer.mockResolvedValue({ id: "session-user-id" });
    createCourtImageUpload.mockResolvedValue({ id: "upload-id" });

    const response = await POST(new Request("http://localhost/api/v1/court-image-uploads", { method: "POST", body: form }));

    expect(response.status).toBe(400);
    expect(createCourtImageUpload).not.toHaveBeenCalled();
  });

  it("returns an opaque id after uploading the selected file for the current user", async () => {
    const prisma = {};
    const form = new FormData();
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], "court.jpg", { type: "image/jpeg" });
    form.set("file", file);
    getRateLimitedCurrentUser.mockResolvedValue({ id: "session-user-id" });
    getPrisma.mockReturnValue(prisma);
    getOnboardedViewer.mockResolvedValue({ id: "session-user-id" });
    createCourtImageUpload.mockResolvedValue({ id: "upload-id" });

    const response = await POST(new Request("http://localhost/api/v1/court-image-uploads", { method: "POST", body: form }));

    expect(response.status).toBe(201);
    expect(createCourtImageUpload).toHaveBeenCalledWith(prisma, "session-user-id", expect.objectContaining({ name: "court.jpg", type: "image/jpeg", size: 3 }));
    await expect(response.json()).resolves.toEqual({ id: "upload-id" });
  });
});
