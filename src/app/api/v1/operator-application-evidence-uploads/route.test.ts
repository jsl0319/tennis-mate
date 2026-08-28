import { beforeEach, describe, expect, it, vi } from "vitest";

const { createBusinessRegistrationCertificateUpload, getPrisma, getRateLimitedCurrentUser } = vi.hoisted(() => ({
  createBusinessRegistrationCertificateUpload: vi.fn(),
  getPrisma: vi.fn(),
  getRateLimitedCurrentUser: vi.fn(),
}));

vi.mock("@/server/auth/current-user", () => ({
  getRateLimitedCurrentUser,
  AuthenticationError: class AuthenticationError extends Error {},
  AccountAccessError: class AccountAccessError extends Error {},
}));
vi.mock("@/server/db/prisma", () => ({ getPrisma }));
vi.mock("@/server/domain/operator-application-evidence-service", () => ({ createBusinessRegistrationCertificateUpload }));

import { POST } from "./route";

function certificate() {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], "business.pdf", { type: "application/pdf" });
}

describe("POST /api/v1/operator-application-evidence-uploads", () => {
  beforeEach(() => {
    createBusinessRegistrationCertificateUpload.mockReset();
    getPrisma.mockReset();
    getRateLimitedCurrentUser.mockReset();
  });

  it("requires exactly one certificate file before object storage", async () => {
    getRateLimitedCurrentUser.mockResolvedValue({ id: "user-id" });
    const response = await POST(new Request("http://localhost/api/v1/operator-application-evidence-uploads", { method: "POST", body: new FormData() }));

    expect(response.status).toBe(422);
    expect(createBusinessRegistrationCertificateUpload).not.toHaveBeenCalled();
  });

  it("rejects a client-supplied owner field", async () => {
    const form = new FormData();
    form.set("file", certificate());
    form.set("ownerUserId", "attacker-id");
    getRateLimitedCurrentUser.mockResolvedValue({ id: "session-user-id" });

    const response = await POST(new Request("http://localhost/api/v1/operator-application-evidence-uploads", { method: "POST", body: form }));

    expect(response.status).toBe(400);
    expect(createBusinessRegistrationCertificateUpload).not.toHaveBeenCalled();
  });

  it("uses the authenticated user and returns only the opaque upload id", async () => {
    const prisma = {};
    const form = new FormData();
    form.set("file", certificate());
    getRateLimitedCurrentUser.mockResolvedValue({ id: "session-user-id" });
    getPrisma.mockReturnValue(prisma);
    createBusinessRegistrationCertificateUpload.mockResolvedValue({ id: "upload-id" });

    const response = await POST(new Request("http://localhost/api/v1/operator-application-evidence-uploads", { method: "POST", body: form }));

    expect(response.status).toBe(201);
    expect(createBusinessRegistrationCertificateUpload).toHaveBeenCalledWith(prisma, "session-user-id", expect.objectContaining({ name: "business.pdf", type: "application/pdf" }));
    await expect(response.json()).resolves.toEqual({ id: "upload-id" });
  });
});
