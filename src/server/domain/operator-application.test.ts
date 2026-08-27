import { describe, expect, it, vi } from "vitest";

import {
  getVerificationDecision,
  normalizeVenueKey,
  operatorApplicationInputSchema,
  type ProviderVerificationResult,
  type OperatorVerificationProvider,
} from "@/server/domain/operator-application";
import {
  retryOperatorApplicationVerification,
  submitOperatorApplication,
  toOperatorApplicationView,
  updateOperatorApplication,
} from "@/server/domain/operator-application-service";

const validInput = {
  businessName: "마포 테니스파크",
  businessRegistrationNumber: "123-45-67890",
  businessOpenedOn: "2024-01-02",
  representativeName: "홍길동",
  venueName: "마포 테니스파크",
  venueAddress: "서울특별시 마포구 월드컵로 00",
  operatorPhone: "010-1234-5678",
};

const verifiedProvider: OperatorVerificationProvider = {
  verify: vi.fn(async (): Promise<ProviderVerificationResult> => ({ business: "VERIFIED", venue: "MATCHED", providerRequestRef: "fake-request" })),
};

describe("operator application input and status policy", () => {
  it("normalizes private inputs without returning them from the public application view", () => {
    const input = operatorApplicationInputSchema.parse(validInput);
    expect(input.businessRegistrationNumber).toBe("1234567890");
    expect(input.operatorPhone).toBe("01012345678");
    expect(() => operatorApplicationInputSchema.parse({ ...validInput, businessRegistrationNumber: "1234" })).toThrow();

    const view = toOperatorApplicationView({
      id: "application-id", status: "REVIEW_REQUIRED", businessName: "마포 테니스파크",
      businessRegistrationNumberHash: "hash", verificationInputRef: null, businessVerificationStatus: "UNAVAILABLE",
      venueVerificationStatus: "UNAVAILABLE", venueName: "마포 테니스파크", venueAddress: "서울 마포구",
      normalizedVenueKey: "venue-key", verificationFailureCode: "VERIFICATION_UNAVAILABLE", submittedAt: new Date(),
      verifiedAt: null, publishApprovedAt: null, createdAt: new Date(), updatedAt: new Date(), applicantUserId: "user-id",
      verificationAttempts: [],
    });
    expect(view).not.toHaveProperty("businessRegistrationNumber");
    expect(view).not.toHaveProperty("operatorPhone");
    expect(view.canPublish).toBe(false);
  });

  it("only grants public approval after business and venue both match without a duplicate", () => {
    expect(getVerificationDecision({ business: "VERIFIED", venue: "MATCHED" }, false).status).toBe("PUBLISH_APPROVED");
    expect(getVerificationDecision({ business: "VERIFIED", venue: "MATCHED" }, true).status).toBe("REVIEW_REQUIRED");
    expect(getVerificationDecision({ business: "VERIFIED", venue: "PENDING" }, false).status).toBe("DRAFT_ACCESS_GRANTED");
    expect(getVerificationDecision({ business: "MISMATCH", venue: "PENDING" }, false).status).toBe("REJECTED");
    const normalizedVenueKey = normalizeVenueKey("마포 테니스파크", "서울 마포구");

    expect(normalizedVenueKey).toBe(normalizeVenueKey("마포테니스파크", "서울  마포구"));
    expect(normalizedVenueKey).toMatch(/^[a-f0-9]{64}$/);
    expect(normalizedVenueKey).not.toContain("\u0000");
    expect(normalizeVenueKey("가", "나3:다")).not.toBe(normalizeVenueKey("가나", "다"));
  });
});

describe("operator application service", () => {
  it("stores only safe verification fields and records both verification attempts", async () => {
    process.env.AUTH_SECRET = "test-auth-secret";
    const created = {
      id: "application-id", status: "PUBLISH_APPROVED", businessName: validInput.businessName,
      businessRegistrationNumberHash: "hash", verificationInputRef: null, businessVerificationStatus: "VERIFIED",
      venueVerificationStatus: "MATCHED", venueName: validInput.venueName, venueAddress: validInput.venueAddress,
      normalizedVenueKey: "venue-key", verificationFailureCode: null, submittedAt: new Date(), verifiedAt: new Date(),
      publishApprovedAt: new Date(), createdAt: new Date(), updatedAt: new Date(), applicantUserId: "user-id", verificationAttempts: [],
    };
    const prisma = {
      courtOperatorApplication: {
        findFirst: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null),
        create: vi.fn().mockResolvedValue(created),
      },
    };

    const application = await submitOperatorApplication(prisma as never, { id: "user-id" }, operatorApplicationInputSchema.parse(validInput), verifiedProvider);

    expect(application.status).toBe("PUBLISH_APPROVED");
    expect(prisma.courtOperatorApplication.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        businessRegistrationNumberHash: expect.any(String),
        status: "PUBLISH_APPROVED",
        verificationAttempts: expect.objectContaining({ create: expect.arrayContaining([expect.objectContaining({ kind: "BUSINESS" }), expect.objectContaining({ kind: "VENUE" })]) }),
      }),
    }));
    expect(JSON.stringify(prisma.courtOperatorApplication.create.mock.calls)).not.toContain(validInput.businessRegistrationNumber);
    expect(JSON.stringify(prisma.courtOperatorApplication.create.mock.calls)).not.toContain(validInput.operatorPhone.replaceAll("-", ""));
  });

  it("blocks a second active application and preserves owner/state checks for changes", async () => {
    const activePrisma = { courtOperatorApplication: { findFirst: vi.fn().mockResolvedValue({ id: "active-id" }) } };
    await expect(submitOperatorApplication(activePrisma as never, { id: "user-id" }, operatorApplicationInputSchema.parse(validInput), verifiedProvider)).rejects.toMatchObject({ code: "OPERATOR_APPLICATION_ALREADY_ACTIVE" });

    const missingPrisma = { courtOperatorApplication: { findFirst: vi.fn().mockResolvedValue(null) } };
    await expect(updateOperatorApplication(missingPrisma as never, { id: "user-id" }, "other-application", operatorApplicationInputSchema.parse(validInput))).rejects.toMatchObject({ code: "OPERATOR_APPLICATION_NOT_FOUND" });
    await expect(retryOperatorApplicationVerification(missingPrisma as never, { id: "user-id" }, "other-application")).rejects.toMatchObject({ code: "OPERATOR_APPLICATION_NOT_FOUND" });
  });
});
