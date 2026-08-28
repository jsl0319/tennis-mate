import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getBusinessRegistrationCertificateObjectRefForReviewer,
  getPrisma,
  getPrivateOperatorApplicationEvidence,
  getRateLimitedCurrentUser,
} = vi.hoisted(() => ({
  getBusinessRegistrationCertificateObjectRefForReviewer: vi.fn(),
  getPrisma: vi.fn(),
  getPrivateOperatorApplicationEvidence: vi.fn(),
  getRateLimitedCurrentUser: vi.fn(),
}));

vi.mock("@/server/auth/current-user", () => ({
  getRateLimitedCurrentUser,
  AuthenticationError: class AuthenticationError extends Error {},
  AccountAccessError: class AccountAccessError extends Error {},
}));
vi.mock("@/server/db/prisma", () => ({ getPrisma }));
vi.mock("@/server/domain/operator-application-evidence-service", () => ({
  getBusinessRegistrationCertificateObjectRefForReviewer,
  getPrivateOperatorApplicationEvidence,
}));

import { GET } from "./route";

const context = { params: Promise.resolve({ applicationId: "00000000-0000-4000-8000-000000000001" }) };

describe("GET /api/internal/operator-applications/{applicationId}/business-registration-certificate", () => {
  beforeEach(() => {
    getBusinessRegistrationCertificateObjectRefForReviewer.mockReset();
    getPrisma.mockReset();
    getPrivateOperatorApplicationEvidence.mockReset();
    getRateLimitedCurrentUser.mockReset();
  });

  it("streams the private certificate only after using the authenticated reviewer", async () => {
    const prisma = {};
    const reviewer = { id: "reviewer-id", role: "INTERNAL_REVIEWER" };
    const stream = new ReadableStream();
    getRateLimitedCurrentUser.mockResolvedValue(reviewer);
    getPrisma.mockReturnValue(prisma);
    getBusinessRegistrationCertificateObjectRefForReviewer.mockResolvedValue("https://blob.example/private/evidence.pdf");
    getPrivateOperatorApplicationEvidence.mockResolvedValue({ statusCode: 200, blob: { etag: "test-etag", contentType: "application/pdf" }, stream });

    const response = await GET(new Request("http://localhost/api/internal/operator-applications/application-id/business-registration-certificate"), context);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(getBusinessRegistrationCertificateObjectRefForReviewer).toHaveBeenCalledWith(prisma, reviewer, "00000000-0000-4000-8000-000000000001");
    expect(getPrivateOperatorApplicationEvidence).toHaveBeenCalledWith("https://blob.example/private/evidence.pdf", null);
  });
});
