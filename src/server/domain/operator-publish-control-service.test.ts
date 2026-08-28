import { describe, expect, it, vi } from "vitest";

import {
  deactivateCourt,
  suspendOperatorApplication,
} from "./operator-publish-control-service";

const reviewer = { id: "reviewer-id", role: "INTERNAL_REVIEWER" };
const input = { reasonCode: "SAFETY_REVIEW" as const };
const now = new Date("2030-01-02T00:00:00.000Z");

describe("operator publish control service", () => {
  it("allows only an internal reviewer to suspend an approved operator and schedules attached photos for removal", async () => {
    const transaction = {
      courtOperatorApplication: {
        findUnique: vi.fn().mockResolvedValue({ applicantUserId: "operator-id", status: "PUBLISH_APPROVED", court: { id: "court-id" } }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      operatorApplicationReview: { create: vi.fn().mockResolvedValue({ id: "review-id" }) },
      courtImage: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
    };
    const prisma = { $transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)) };

    await expect(suspendOperatorApplication(prisma as never, reviewer, "application-id", input, now)).resolves.toEqual({
      application: { id: "application-id", status: "SUSPENDED" },
      imageExpiresAt: "2030-02-01T00:00:00.000Z",
    });

    expect(transaction.courtOperatorApplication.updateMany).toHaveBeenCalledWith({
      where: { id: "application-id", status: "PUBLISH_APPROVED" },
      data: { status: "SUSPENDED", verificationFailureCode: "SAFETY_REVIEW" },
    });
    expect(transaction.operatorApplicationReview.create).toHaveBeenCalledWith({
      data: { applicationId: "application-id", reviewerUserId: "reviewer-id", decision: "SUSPEND_PUBLISH", reasonCode: "SAFETY_REVIEW" },
    });
    expect(transaction.courtImage.updateMany).toHaveBeenCalledWith({
      where: { courtId: "court-id", status: "ATTACHED", expiresAt: null },
      data: { expiresAt: new Date("2030-02-01T00:00:00.000Z") },
    });
  });

  it("rejects a stale or self suspension without recording an audit event", async () => {
    const staleTransaction = {
      courtOperatorApplication: {
        findUnique: vi.fn().mockResolvedValue({ applicantUserId: "operator-id", status: "PUBLISH_APPROVED", court: null }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      operatorApplicationReview: { create: vi.fn() },
      courtImage: { updateMany: vi.fn() },
    };
    const stalePrisma = { $transaction: vi.fn(async (callback: (value: typeof staleTransaction) => unknown) => callback(staleTransaction)) };

    await expect(suspendOperatorApplication(stalePrisma as never, reviewer, "application-id", input, now)).rejects.toMatchObject({
      code: "OPERATOR_APPLICATION_STATE_CONFLICT",
      status: 409,
    });
    expect(staleTransaction.operatorApplicationReview.create).not.toHaveBeenCalled();

    const selfPrisma = { $transaction: vi.fn() };
    await expect(suspendOperatorApplication(selfPrisma as never, { id: "reviewer-id", role: "MEMBER" }, "application-id", input, now)).rejects.toMatchObject({
      code: "INTERNAL_REVIEWER_REQUIRED",
      status: 403,
    });
    expect(selfPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("deactivates an approved active court without changing its connected session and records the transition", async () => {
    const transaction = {
      court: {
        findUnique: vi.fn().mockResolvedValue({ status: "ACTIVE", operatorApplication: { applicantUserId: "operator-id", status: "PUBLISH_APPROVED" } }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      courtStatusChange: { create: vi.fn().mockResolvedValue({ id: "change-id" }) },
      courtImage: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = { $transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)) };

    await expect(deactivateCourt(prisma as never, reviewer, "court-id", { reasonCode: "VENUE_CLOSED" }, now)).resolves.toEqual({
      court: { id: "court-id", status: "INACTIVE", deactivatedAt: "2030-01-02T00:00:00.000Z" },
      imageExpiresAt: "2030-02-01T00:00:00.000Z",
    });

    expect(transaction.court.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "court-id", status: "ACTIVE", operatorApplication: { status: "PUBLISH_APPROVED" } },
      data: { status: "INACTIVE", deactivatedAt: now },
    }));
    expect(transaction.courtStatusChange.create).toHaveBeenCalledWith({
      data: { courtId: "court-id", reviewerUserId: "reviewer-id", fromStatus: "ACTIVE", toStatus: "INACTIVE", reasonCode: "VENUE_CLOSED" },
    });
    expect(transaction).not.toHaveProperty("match");
  });

  it("rejects a self-review and a non-active court before writing the court audit", async () => {
    const selfTransaction = {
      court: { findUnique: vi.fn().mockResolvedValue({ status: "ACTIVE", operatorApplication: { applicantUserId: "reviewer-id", status: "PUBLISH_APPROVED" } }) },
    };
    const selfPrisma = { $transaction: vi.fn(async (callback: (value: typeof selfTransaction) => unknown) => callback(selfTransaction)) };
    await expect(deactivateCourt(selfPrisma as never, reviewer, "court-id", input, now)).rejects.toMatchObject({ code: "INTERNAL_REVIEWER_SELF_REVIEW_FORBIDDEN", status: 403 });

    const inactiveTransaction = {
      court: { findUnique: vi.fn().mockResolvedValue({ status: "INACTIVE", operatorApplication: { applicantUserId: "operator-id", status: "PUBLISH_APPROVED" } }), updateMany: vi.fn() },
      courtStatusChange: { create: vi.fn() },
    };
    const inactivePrisma = { $transaction: vi.fn(async (callback: (value: typeof inactiveTransaction) => unknown) => callback(inactiveTransaction)) };
    await expect(deactivateCourt(inactivePrisma as never, reviewer, "court-id", input, now)).rejects.toMatchObject({ code: "COURT_STATE_CONFLICT", status: 409 });
    expect(inactiveTransaction.courtStatusChange.create).not.toHaveBeenCalled();
  });
});
