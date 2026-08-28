import { beforeEach, describe, expect, it, vi } from "vitest";

const { createOperatorCourtImageUpload, getPrisma, getRateLimitedCurrentUser, listOperatorCourtImages, saveOperatorCourtImages } = vi.hoisted(() => ({
  createOperatorCourtImageUpload: vi.fn(),
  getPrisma: vi.fn(),
  getRateLimitedCurrentUser: vi.fn(),
  listOperatorCourtImages: vi.fn(),
  saveOperatorCourtImages: vi.fn(),
}));

vi.mock("@/server/auth/current-user", () => ({
  getRateLimitedCurrentUser,
  AuthenticationError: class AuthenticationError extends Error {},
  AccountAccessError: class AccountAccessError extends Error {},
}));
vi.mock("@/server/db/prisma", () => ({ getPrisma }));
vi.mock("@/server/domain/operator-court-image-service", () => ({ createOperatorCourtImageUpload, listOperatorCourtImages, saveOperatorCourtImages }));

import { POST, PUT } from "./route";

describe("operator court image routes", () => {
  beforeEach(() => {
    createOperatorCourtImageUpload.mockReset();
    getPrisma.mockReset();
    getRateLimitedCurrentUser.mockReset();
    listOperatorCourtImages.mockReset();
    saveOperatorCourtImages.mockReset();
  });

  it("does not accept a client supplied owner field with a photo", async () => {
    const form = new FormData();
    form.set("file", new File([new Uint8Array([0xff, 0xd8, 0xff])], "court.jpg", { type: "image/jpeg" }));
    form.set("ownerUserId", "attacker-id");
    getRateLimitedCurrentUser.mockResolvedValue({ id: "operator-id" });

    const response = await POST(new Request("http://localhost/api/v1/operator/courts/1a37e0d3-ec93-43e9-b61d-970e21f38a9d/images", { method: "POST", body: form }), {
      params: Promise.resolve({ courtId: "1a37e0d3-ec93-43e9-b61d-970e21f38a9d" }),
    });

    expect(response.status).toBe(400);
    expect(createOperatorCourtImageUpload).not.toHaveBeenCalled();
  });

  it("uses the authenticated operator and validates a representative selection before saving", async () => {
    const prisma = {};
    getPrisma.mockReturnValue(prisma);
    getRateLimitedCurrentUser.mockResolvedValue({ id: "operator-id" });
    saveOperatorCourtImages.mockResolvedValue({ items: [] });
    const courtId = "1a37e0d3-ec93-43e9-b61d-970e21f38a9d";
    const imageId = "25e24c1d-f078-44f1-9166-7b3e959c4e57";

    const response = await PUT(new Request(`http://localhost/api/v1/operator/courts/${courtId}/images`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageIds: [imageId], representativeImageId: imageId }),
    }), { params: Promise.resolve({ courtId }) });

    expect(response.status).toBe(200);
    expect(saveOperatorCourtImages).toHaveBeenCalledWith(prisma, { id: "operator-id" }, courtId, { imageIds: [imageId], representativeImageId: imageId });
  });

  it("rejects a representative that was not included in the save list", async () => {
    getRateLimitedCurrentUser.mockResolvedValue({ id: "operator-id" });
    const courtId = "1a37e0d3-ec93-43e9-b61d-970e21f38a9d";

    const response = await PUT(new Request(`http://localhost/api/v1/operator/courts/${courtId}/images`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageIds: ["25e24c1d-f078-44f1-9166-7b3e959c4e57"], representativeImageId: "c3df4d10-0201-4f88-b75d-2bc6aab71aeb" }),
    }), { params: Promise.resolve({ courtId }) });

    expect(response.status).toBe(422);
    expect(saveOperatorCourtImages).not.toHaveBeenCalled();
  });
});
