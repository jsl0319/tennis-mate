import { beforeEach, describe, expect, it, vi } from "vitest";

const { AuthenticationError, getCurrentUser, getOnboardedViewer, getPrisma, getPrivateOperatorCourtImage, getPublicCourtImageObjectRef } = vi.hoisted(() => ({
  AuthenticationError: class AuthenticationError extends Error {},
  getCurrentUser: vi.fn(),
  getOnboardedViewer: vi.fn(),
  getPrisma: vi.fn(),
  getPrivateOperatorCourtImage: vi.fn(),
  getPublicCourtImageObjectRef: vi.fn(),
}));

vi.mock("@/server/auth/current-user", () => ({
  getCurrentUser,
  AuthenticationError,
  AccountAccessError: class AccountAccessError extends Error {},
}));
vi.mock("@/server/db/prisma", () => ({ getPrisma }));
vi.mock("@/server/domain/match-service", () => ({ getOnboardedViewer }));
vi.mock("@/server/domain/operator-court-image-service", () => ({ getPrivateOperatorCourtImage, getPublicCourtImageObjectRef }));

import { GET } from "./route";

describe("GET /api/v1/partner-courts/[courtId]/image", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    getOnboardedViewer.mockReset();
    getPrisma.mockReset();
    getPrivateOperatorCourtImage.mockReset();
    getPublicCourtImageObjectRef.mockReset();
  });

  it("requires an authenticated, onboarded viewer before looking up the representative photo", async () => {
    getCurrentUser.mockRejectedValue(new AuthenticationError("로그인이 필요해요."));

    const response = await GET(new Request("http://localhost/api/v1/partner-courts/1a37e0d3-ec93-43e9-b61d-970e21f38a9d/image"), {
      params: Promise.resolve({ courtId: "1a37e0d3-ec93-43e9-b61d-970e21f38a9d" }),
    });

    expect(response.status).toBe(401);
    expect(getPublicCourtImageObjectRef).not.toHaveBeenCalled();
  });

  it("streams the protected representative photo without exposing a Blob URL", async () => {
    const prisma = {};
    getPrisma.mockReturnValue(prisma);
    getCurrentUser.mockResolvedValue({ id: "member-id" });
    getOnboardedViewer.mockResolvedValue({ id: "member-id" });
    getPublicCourtImageObjectRef.mockResolvedValue("https://blob.example/private/court.jpg");
    getPrivateOperatorCourtImage.mockResolvedValue({
      statusCode: 200,
      blob: { etag: "photo-etag", contentType: "image/jpeg" },
      stream: new ReadableStream(),
    });
    const courtId = "1a37e0d3-ec93-43e9-b61d-970e21f38a9d";

    const response = await GET(new Request(`http://localhost/api/v1/partner-courts/${courtId}/image`), { params: Promise.resolve({ courtId }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=300");
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(getOnboardedViewer).toHaveBeenCalledWith(prisma, { id: "member-id" });
    expect(getPrivateOperatorCourtImage).toHaveBeenCalledWith("https://blob.example/private/court.jpg", null);
  });
});
