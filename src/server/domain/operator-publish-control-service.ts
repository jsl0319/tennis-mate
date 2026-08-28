import type { PrismaClient } from "@/generated/prisma/client";

import {
  assertInternalReviewer,
} from "@/server/domain/operator-application-service";
import {
  getInactiveOperatorCourtImageExpiresAt,
  scheduleOperatorCourtImagesForExpiry,
} from "@/server/domain/operator-court-image-service";
import type {
  CourtDeactivateInput,
  OperatorApplicationSuspendInput,
} from "@/server/domain/operator-application";
import { DomainError } from "@/server/domain/profile-service";

type InternalReviewer = { id: string; role: string };

export async function suspendOperatorApplication(
  prisma: PrismaClient,
  reviewer: InternalReviewer,
  applicationId: string,
  input: OperatorApplicationSuspendInput,
  now = new Date(),
) {
  assertInternalReviewer(reviewer);

  return prisma.$transaction(async (transaction) => {
    const current = await transaction.courtOperatorApplication.findUnique({
      where: { id: applicationId },
      select: {
        applicantUserId: true,
        status: true,
        court: { select: { id: true } },
      },
    });
    if (!current) throw new DomainError("OPERATOR_APPLICATION_NOT_FOUND", 404, "운영자 신청을 찾을 수 없어요.");
    if (current.applicantUserId === reviewer.id) {
      throw new DomainError("INTERNAL_REVIEWER_SELF_REVIEW_FORBIDDEN", 403, "자신의 운영자 신청은 심사할 수 없어요.");
    }
    if (current.status !== "PUBLISH_APPROVED") {
      throw new DomainError("OPERATOR_APPLICATION_STATE_CONFLICT", 409, "현재 공개 승인 상태만 일시 중지할 수 있어요.");
    }

    const updated = await transaction.courtOperatorApplication.updateMany({
      where: { id: applicationId, status: "PUBLISH_APPROVED" },
      data: { status: "SUSPENDED", verificationFailureCode: input.reasonCode },
    });
    if (updated.count !== 1) {
      throw new DomainError("OPERATOR_APPLICATION_STATE_CONFLICT", 409, "최신 운영자 상태를 다시 확인해 주세요.");
    }

    await transaction.operatorApplicationReview.create({
      data: {
        applicationId,
        reviewerUserId: reviewer.id,
        decision: "SUSPEND_PUBLISH",
        reasonCode: input.reasonCode,
      },
    });

    if (current.court) {
      await scheduleOperatorCourtImagesForExpiry(transaction, current.court.id, now);
    }

    return {
      application: { id: applicationId, status: "SUSPENDED" as const },
      imageExpiresAt: current.court ? getInactiveOperatorCourtImageExpiresAt(now).toISOString() : null,
    };
  });
}

export async function deactivateCourt(
  prisma: PrismaClient,
  reviewer: InternalReviewer,
  courtId: string,
  input: CourtDeactivateInput,
  now = new Date(),
) {
  assertInternalReviewer(reviewer);

  return prisma.$transaction(async (transaction) => {
    const current = await transaction.court.findUnique({
      where: { id: courtId },
      select: {
        status: true,
        operatorApplication: { select: { applicantUserId: true, status: true } },
      },
    });
    if (!current) throw new DomainError("COURT_NOT_FOUND", 404, "코트장을 찾을 수 없어요.");
    if (current.operatorApplication.applicantUserId === reviewer.id) {
      throw new DomainError("INTERNAL_REVIEWER_SELF_REVIEW_FORBIDDEN", 403, "자신의 운영자 신청에 연결된 코트는 비활성화할 수 없어요.");
    }
    if (current.status !== "ACTIVE" || current.operatorApplication.status !== "PUBLISH_APPROVED") {
      throw new DomainError("COURT_STATE_CONFLICT", 409, "현재 공개 중인 코트만 비활성화할 수 있어요.");
    }

    const updated = await transaction.court.updateMany({
      where: {
        id: courtId,
        status: "ACTIVE",
        operatorApplication: { status: "PUBLISH_APPROVED" },
      },
      data: { status: "INACTIVE", deactivatedAt: now },
    });
    if (updated.count !== 1) {
      throw new DomainError("COURT_STATE_CONFLICT", 409, "최신 코트 상태를 다시 확인해 주세요.");
    }

    await transaction.courtStatusChange.create({
      data: {
        courtId,
        reviewerUserId: reviewer.id,
        fromStatus: "ACTIVE",
        toStatus: "INACTIVE",
        reasonCode: input.reasonCode,
      },
    });
    await scheduleOperatorCourtImagesForExpiry(transaction, courtId, now);

    return {
      court: { id: courtId, status: "INACTIVE" as const, deactivatedAt: now.toISOString() },
      imageExpiresAt: getInactiveOperatorCourtImageExpiresAt(now).toISOString(),
    };
  });
}
