import { describe, expect, it, vi } from "vitest";

import {
  operatorApplicationReviewInputSchema,
} from "@/server/domain/operator-application";
import {
  listOperatorApplicationsForReview,
  reviewOperatorApplication,
} from "@/server/domain/operator-application-service";

const reviewer = { id: "reviewer-id", role: "INTERNAL_REVIEWER" };
const reviewInput = operatorApplicationReviewInputSchema.parse({
  decision: "APPROVE_PUBLISH",
  reasonCode: "MANUAL_VERIFIED",
});

describe("internal operator application review service", () => {
  it("returns only safe pending application fields with an opaque cursor", async () => {
    const first = {
      id: "00000000-0000-4000-8000-000000000001",
      businessName: "마포 테니스파크",
      businessVerificationStatus: "UNAVAILABLE",
      venueVerificationStatus: "UNAVAILABLE",
      venueName: "마포 테니스파크",
      venueAddress: "서울특별시 마포구 월드컵로 00",
      submittedAt: new Date("2026-08-28T01:00:00.000Z"),
    };
    const second = { ...first, id: "00000000-0000-4000-8000-000000000002" };
    const findMany = vi.fn().mockResolvedValue([first, second]);
    const prisma = { courtOperatorApplication: { findMany } };

    const result = await listOperatorApplicationsForReview(prisma as never, reviewer, {
      status: "REVIEW_REQUIRED",
      limit: 1,
    });

    expect(result.items).toEqual([expect.objectContaining({ id: first.id, venue: { name: first.venueName, address: first.venueAddress } })]);
    expect(result.items[0]).not.toHaveProperty("businessRegistrationNumber");
    expect(result.pageInfo).toEqual({ hasNext: true, nextCursor: expect.any(String) });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: "REVIEW_REQUIRED" }), take: 2 }));
  });

  it("rejects a non-reviewer before reading the pending list", async () => {
    const findMany = vi.fn();
    const prisma = { courtOperatorApplication: { findMany } };

    await expect(listOperatorApplicationsForReview(prisma as never, { role: "MEMBER" }, { status: "REVIEW_REQUIRED", limit: 20 })).rejects.toMatchObject({ code: "INTERNAL_REVIEWER_REQUIRED", status: 403 });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("rejects a non-reviewer before starting a review transaction", async () => {
    const transaction = vi.fn();
    const prisma = { $transaction: transaction };

    await expect(reviewOperatorApplication(prisma as never, { id: "member-id", role: "MEMBER" }, "application-id", reviewInput)).rejects.toMatchObject({ code: "INTERNAL_REVIEWER_REQUIRED", status: 403 });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("approves one pending application and writes an immutable reviewer audit record", async () => {
    const current = {
      applicantUserId: "operator-user-id",
      normalizedVenueKey: "venue-key",
      status: "REVIEW_REQUIRED",
      businessRegistrationCertificateUploadId: "certificate-id",
      businessRegistrationCertificate: { status: "ATTACHED" },
    };
    const reviewed = { id: "application-id", status: "PUBLISH_APPROVED", verificationAttempts: [] };
    const transaction = {
      courtOperatorApplication: {
        findUnique: vi.fn().mockResolvedValueOnce(current).mockResolvedValueOnce(reviewed),
        findFirst: vi.fn().mockResolvedValue(null),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      operatorApplicationEvidenceUpload: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      operatorApplicationReview: { create: vi.fn().mockResolvedValue({ id: "review-id" }) },
    };
    const prisma = { $transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)) };

    const result = await reviewOperatorApplication(prisma as never, reviewer, "application-id", reviewInput);

    expect(result).toEqual(reviewed);
    expect(transaction.courtOperatorApplication.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "application-id", status: "REVIEW_REQUIRED" },
      data: expect.objectContaining({ status: "PUBLISH_APPROVED", businessVerificationStatus: "VERIFIED", venueVerificationStatus: "MATCHED" }),
    }));
    expect(transaction.operatorApplicationReview.create).toHaveBeenCalledWith({
      data: { applicationId: "application-id", reviewerUserId: reviewer.id, decision: "APPROVE_PUBLISH", reasonCode: "MANUAL_VERIFIED" },
    });
    expect(transaction.operatorApplicationEvidenceUpload.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "certificate-id", status: "ATTACHED" },
      data: { expiresAt: expect.any(Date) },
    }));
  });

  it("blocks self review and a concurrent stale decision without creating an audit record", async () => {
    const selfTransaction = {
      courtOperatorApplication: {
        findUnique: vi.fn().mockResolvedValue({ applicantUserId: reviewer.id, normalizedVenueKey: "venue-key", status: "REVIEW_REQUIRED" }),
      },
    };
    const selfPrisma = { $transaction: vi.fn(async (callback: (value: typeof selfTransaction) => unknown) => callback(selfTransaction)) };

    await expect(reviewOperatorApplication(selfPrisma as never, reviewer, "application-id", reviewInput)).rejects.toMatchObject({ code: "INTERNAL_REVIEWER_SELF_REVIEW_FORBIDDEN", status: 403 });

    const staleTransaction = {
      courtOperatorApplication: {
        findUnique: vi.fn().mockResolvedValue({ applicantUserId: "operator-user-id", normalizedVenueKey: "venue-key", status: "REVIEW_REQUIRED", businessRegistrationCertificateUploadId: "certificate-id", businessRegistrationCertificate: { status: "ATTACHED" } }),
        findFirst: vi.fn().mockResolvedValue(null),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      operatorApplicationReview: { create: vi.fn() },
    };
    const stalePrisma = { $transaction: vi.fn(async (callback: (value: typeof staleTransaction) => unknown) => callback(staleTransaction)) };

    await expect(reviewOperatorApplication(stalePrisma as never, reviewer, "application-id", reviewInput)).rejects.toMatchObject({ code: "OPERATOR_APPLICATION_STATE_CONFLICT", status: 409 });
    expect(staleTransaction.operatorApplicationReview.create).not.toHaveBeenCalled();
  });

  it("blocks approval when another approved application already owns the venue", async () => {
    const transaction = {
      courtOperatorApplication: {
        findUnique: vi.fn().mockResolvedValue({ applicantUserId: "operator-user-id", normalizedVenueKey: "venue-key", status: "REVIEW_REQUIRED", businessRegistrationCertificateUploadId: "certificate-id", businessRegistrationCertificate: { status: "ATTACHED" } }),
        findFirst: vi.fn().mockResolvedValue({ id: "other-approved-application" }),
        updateMany: vi.fn(),
      },
      operatorApplicationReview: { create: vi.fn() },
    };
    const prisma = { $transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)) };

    await expect(reviewOperatorApplication(prisma as never, reviewer, "application-id", reviewInput)).rejects.toMatchObject({ code: "VENUE_ALREADY_ACTIVE", status: 409 });
    expect(transaction.courtOperatorApplication.updateMany).not.toHaveBeenCalled();
    expect(transaction.operatorApplicationReview.create).not.toHaveBeenCalled();
  });

  it("does not publish an application without an attached business registration certificate", async () => {
    const transaction = {
      courtOperatorApplication: {
        findUnique: vi.fn().mockResolvedValue({ applicantUserId: "operator-user-id", normalizedVenueKey: "venue-key", status: "REVIEW_REQUIRED", businessRegistrationCertificateUploadId: null, businessRegistrationCertificate: null }),
        findFirst: vi.fn(),
        updateMany: vi.fn(),
      },
      operatorApplicationReview: { create: vi.fn() },
    };
    const prisma = { $transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)) };

    await expect(reviewOperatorApplication(prisma as never, reviewer, "application-id", reviewInput)).rejects.toMatchObject({ code: "BUSINESS_REGISTRATION_CERTIFICATE_REQUIRED", status: 409 });
    expect(transaction.courtOperatorApplication.findFirst).not.toHaveBeenCalled();
    expect(transaction.operatorApplicationReview.create).not.toHaveBeenCalled();
  });
});
