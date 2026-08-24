import type { Prisma, PrismaClient } from "@/generated/prisma/client";

import {
  activeOperatorApplicationStatuses,
  createBusinessRegistrationNumberHash,
  getVerificationDecision,
  manualVerificationProvider,
  normalizeVenueKey,
  type OperatorApplicationInput,
  type OperatorVerificationProvider,
} from "@/server/domain/operator-application";
import { DomainError } from "@/server/domain/profile-service";

const operatorApplicationInclude = {
  verificationAttempts: { orderBy: { attemptedAt: "desc" }, take: 1 },
} satisfies Prisma.CourtOperatorApplicationInclude;

type OperatorApplicationWithAttempts = Prisma.CourtOperatorApplicationGetPayload<{
  include: typeof operatorApplicationInclude;
}>;

const statusLabels = {
  DRAFT: "입력 중",
  VERIFYING: "자동 확인 중",
  DRAFT_ACCESS_GRANTED: "코트 초안 작성 가능",
  REVIEW_REQUIRED: "추가 확인이 필요해요",
  UNDER_REVIEW: "확인하고 있어요",
  CHANGES_REQUESTED: "정보를 보완해 주세요",
  PUBLISH_APPROVED: "운영자 등록이 완료됐어요",
  REJECTED: "현재 정보로는 등록이 어려워요",
  SUSPENDED: "공개가 일시 중지됐어요",
} as const;

function nextAction(status: keyof typeof statusLabels) {
  switch (status) {
    case "DRAFT_ACCESS_GRANTED":
      return "코트와 시간대를 비공개 초안으로 준비할 수 있어요.";
    case "PUBLISH_APPROVED":
      return "운영자 홈에서 코트와 시간대를 공개할 수 있어요.";
    case "REJECTED":
      return "정보를 고쳐 새로 등록을 요청할 수 있어요.";
    case "REVIEW_REQUIRED":
    case "CHANGES_REQUESTED":
      return "정보를 다시 확인하거나 추가 확인을 요청해 주세요.";
    default:
      return "제출한 정보를 확인하고 있어요.";
  }
}

export function toOperatorApplicationView(application: OperatorApplicationWithAttempts) {
  return {
    id: application.id,
    status: application.status,
    statusLabel: statusLabels[application.status],
    businessVerificationStatus: application.businessVerificationStatus,
    venueVerificationStatus: application.venueVerificationStatus,
    venue: { name: application.venueName, address: application.venueAddress },
    canCreatePrivateDraft: application.status === "DRAFT_ACCESS_GRANTED" || application.status === "PUBLISH_APPROVED",
    canPublish: application.status === "PUBLISH_APPROVED",
    retryAvailable: application.status === "REVIEW_REQUIRED" || application.status === "DRAFT_ACCESS_GRANTED",
    nextAction: nextAction(application.status),
    updatedAt: application.updatedAt.toISOString(),
  };
}

async function hasActiveVenueOperator(prisma: PrismaClient, normalizedVenueKey: string, excludingApplicationId?: string) {
  const application = await prisma.courtOperatorApplication.findFirst({
    where: {
      normalizedVenueKey,
      status: "PUBLISH_APPROVED",
      ...(excludingApplicationId ? { NOT: { id: excludingApplicationId } } : {}),
    },
    select: { id: true },
  });
  return application !== null;
}

async function verifyInput(
  prisma: PrismaClient,
  input: OperatorApplicationInput,
  provider: OperatorVerificationProvider,
  excludingApplicationId?: string,
) {
  const verification = await provider.verify(input);
  const normalizedVenueKey = normalizeVenueKey(input.venueName, input.venueAddress);
  const duplicate = await hasActiveVenueOperator(prisma, normalizedVenueKey, excludingApplicationId);
  return { verification, normalizedVenueKey, decision: getVerificationDecision(verification, duplicate) };
}

export async function submitOperatorApplication(
  prisma: PrismaClient,
  viewer: { id: string },
  input: OperatorApplicationInput,
  provider: OperatorVerificationProvider = manualVerificationProvider,
) {
  const active = await prisma.courtOperatorApplication.findFirst({
    where: { applicantUserId: viewer.id, status: { in: [...activeOperatorApplicationStatuses] } },
    select: { id: true },
  });
  if (active) throw new DomainError("OPERATOR_APPLICATION_ALREADY_ACTIVE", 409, "진행 중인 운영자 신청이 있어요.");

  const { verification, normalizedVenueKey, decision } = await verifyInput(prisma, input, provider);
  const now = new Date();
  const application = await prisma.courtOperatorApplication.create({
    data: {
      applicantUserId: viewer.id,
      status: decision.status,
      businessName: input.businessName,
      businessRegistrationNumberHash: createBusinessRegistrationNumberHash(input.businessRegistrationNumber),
      businessVerificationStatus: decision.businessVerificationStatus,
      venueVerificationStatus: decision.venueVerificationStatus,
      venueName: input.venueName,
      venueAddress: input.venueAddress,
      normalizedVenueKey,
      verificationFailureCode: decision.verificationFailureCode,
      submittedAt: now,
      verifiedAt: decision.businessVerificationStatus === "VERIFIED" ? now : null,
      publishApprovedAt: decision.status === "PUBLISH_APPROVED" ? now : null,
      verificationAttempts: {
        create: [
          { kind: "BUSINESS", result: verification.business === "VERIFIED" ? "VERIFIED" : verification.business, safeFailureCode: decision.verificationFailureCode, providerRequestRef: verification.providerRequestRef },
          { kind: "VENUE", result: verification.venue === "MATCHED" ? "VERIFIED" : verification.venue, safeFailureCode: decision.verificationFailureCode, providerRequestRef: verification.providerRequestRef },
        ],
      },
    },
    include: operatorApplicationInclude,
  });
  return application;
}

export async function getMyOperatorApplication(prisma: PrismaClient, viewer: { id: string }) {
  const application = await prisma.courtOperatorApplication.findFirst({
    where: { applicantUserId: viewer.id },
    include: operatorApplicationInclude,
    orderBy: { createdAt: "desc" },
  });
  if (!application) throw new DomainError("OPERATOR_APPLICATION_NOT_FOUND", 404, "운영자 신청 내역이 없어요.");
  return application;
}

export async function updateOperatorApplication(
  prisma: PrismaClient,
  viewer: { id: string },
  applicationId: string,
  input: OperatorApplicationInput,
  provider: OperatorVerificationProvider = manualVerificationProvider,
) {
  const current = await prisma.courtOperatorApplication.findFirst({ where: { id: applicationId, applicantUserId: viewer.id } });
  if (!current) throw new DomainError("OPERATOR_APPLICATION_NOT_FOUND", 404, "운영자 신청을 찾을 수 없어요.");
  if (!["REVIEW_REQUIRED", "CHANGES_REQUESTED", "REJECTED"].includes(current.status)) {
    throw new DomainError("OPERATOR_APPLICATION_STATE_CONFLICT", 409, "현재 상태에서는 정보를 수정할 수 없어요.");
  }

  const { verification, normalizedVenueKey, decision } = await verifyInput(prisma, input, provider, applicationId);
  const now = new Date();
  return prisma.courtOperatorApplication.update({
    where: { id: applicationId },
    data: {
      status: decision.status,
      businessName: input.businessName,
      businessRegistrationNumberHash: createBusinessRegistrationNumberHash(input.businessRegistrationNumber),
      businessVerificationStatus: decision.businessVerificationStatus,
      venueVerificationStatus: decision.venueVerificationStatus,
      venueName: input.venueName,
      venueAddress: input.venueAddress,
      normalizedVenueKey,
      verificationFailureCode: decision.verificationFailureCode,
      submittedAt: now,
      verifiedAt: decision.businessVerificationStatus === "VERIFIED" ? now : null,
      publishApprovedAt: decision.status === "PUBLISH_APPROVED" ? now : null,
      verificationAttempts: {
        create: [
          { kind: "BUSINESS", result: verification.business === "VERIFIED" ? "VERIFIED" : verification.business, safeFailureCode: decision.verificationFailureCode, providerRequestRef: verification.providerRequestRef },
          { kind: "VENUE", result: verification.venue === "MATCHED" ? "VERIFIED" : verification.venue, safeFailureCode: decision.verificationFailureCode, providerRequestRef: verification.providerRequestRef },
        ],
      },
    },
    include: operatorApplicationInclude,
  });
}

export async function retryOperatorApplicationVerification(prisma: PrismaClient, viewer: { id: string }, applicationId: string) {
  const current = await prisma.courtOperatorApplication.findFirst({ where: { id: applicationId, applicantUserId: viewer.id } });
  if (!current) throw new DomainError("OPERATOR_APPLICATION_NOT_FOUND", 404, "운영자 신청을 찾을 수 없어요.");
  if (!["REVIEW_REQUIRED", "DRAFT_ACCESS_GRANTED"].includes(current.status)) {
    throw new DomainError("OPERATOR_APPLICATION_STATE_CONFLICT", 409, "현재 상태에서는 다시 확인할 수 없어요.");
  }

  // Raw verification input is intentionally not retained until a separate encrypted store is approved.
  throw new DomainError("OPERATOR_APPLICATION_RESUBMISSION_REQUIRED", 409, "정보를 다시 입력한 뒤 확인을 요청해 주세요.");
}
