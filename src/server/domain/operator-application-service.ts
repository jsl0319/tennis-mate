import { Prisma, type PrismaClient } from "@/generated/prisma/client";

import {
  activeOperatorApplicationStatuses,
  createBusinessRegistrationNumberHash,
  getVerificationDecision,
  manualVerificationProvider,
  normalizeVenueKey,
  type OperatorApplicationReviewInput,
  type OperatorApplicationReviewListQuery,
  type OperatorApplicationInput,
  type OperatorVerificationProvider,
} from "@/server/domain/operator-application";
import {
  claimBusinessRegistrationCertificate,
  expireBusinessRegistrationCertificate,
  replaceClaimedBusinessRegistrationCertificate,
} from "@/server/domain/operator-application-evidence-service";
import { DomainError } from "@/server/domain/profile-service";

const operatorApplicationInclude = {
  verificationAttempts: { orderBy: { attemptedAt: "desc" }, take: 1 },
  businessRegistrationCertificate: { select: { status: true } },
} satisfies Prisma.CourtOperatorApplicationInclude;

type OperatorApplicationWithAttempts = Prisma.CourtOperatorApplicationGetPayload<{
  include: typeof operatorApplicationInclude;
}>;

type InternalReviewApplication = Prisma.CourtOperatorApplicationGetPayload<{
  select: {
    id: true;
    status: true;
    businessName: true;
    businessVerificationStatus: true;
    venueVerificationStatus: true;
    venueName: true;
    venueAddress: true;
    submittedAt: true;
    businessRegistrationCertificate: { select: { status: true } };
    court: { select: { id: true; name: true; address: true; status: true } };
  };
}>;

type InternalReviewCursor = { submittedAt: string; id: string };

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
    businessRegistrationCertificate: {
      uploadId: application.businessRegistrationCertificateUploadId,
      attached: application.businessRegistrationCertificate?.status === "ATTACHED",
    },
    nextAction: nextAction(application.status),
    updatedAt: application.updatedAt.toISOString(),
  };
}

function toInternalReviewApplicationView(application: InternalReviewApplication) {
  return {
    id: application.id,
    status: application.status,
    businessName: application.businessName,
    businessVerificationStatus: application.businessVerificationStatus,
    venueVerificationStatus: application.venueVerificationStatus,
    venue: { name: application.venueName, address: application.venueAddress },
    submittedAt: application.submittedAt?.toISOString() ?? null,
    businessRegistrationCertificateAvailable: application.businessRegistrationCertificate?.status === "ATTACHED",
    court: application.court
      ? { id: application.court.id, name: application.court.name, address: application.court.address, status: application.court.status }
      : null,
  };
}

function parseInternalReviewCursor(cursor: string): InternalReviewCursor {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("Invalid cursor");
    const value = parsed as { id?: unknown; submittedAt?: unknown };
    if (
      typeof value.id !== "string"
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.id)
      || typeof value.submittedAt !== "string"
      || Number.isNaN(new Date(value.submittedAt).getTime())
    ) throw new Error("Invalid cursor");
    return { id: value.id, submittedAt: value.submittedAt };
  } catch {
    throw new DomainError("INVALID_REVIEW_CURSOR", 400, "심사 목록을 다시 불러와 주세요.");
  }
}

function createInternalReviewCursor(application: InternalReviewApplication) {
  if (!application.submittedAt) return null;
  return Buffer.from(JSON.stringify({ id: application.id, submittedAt: application.submittedAt.toISOString() })).toString("base64url");
}

export function assertInternalReviewer(viewer: { role: string }) {
  if (viewer.role !== "INTERNAL_REVIEWER") {
    throw new DomainError("INTERNAL_REVIEWER_REQUIRED", 403, "내부 심사 권한이 필요해요.");
  }
}

export async function listOperatorApplicationsForReview(
  prisma: PrismaClient,
  viewer: { role: string },
  query: OperatorApplicationReviewListQuery,
) {
  assertInternalReviewer(viewer);
  const cursor = query.cursor ? parseInternalReviewCursor(query.cursor) : null;
  const applications = await prisma.courtOperatorApplication.findMany({
    where: {
      status: query.status,
      submittedAt: { not: null },
      ...(cursor ? {
        OR: [
          { submittedAt: { gt: new Date(cursor.submittedAt) } },
          { submittedAt: new Date(cursor.submittedAt), id: { gt: cursor.id } },
        ],
      } : {}),
    },
    select: {
      id: true,
      status: true,
      businessName: true,
      businessVerificationStatus: true,
      venueVerificationStatus: true,
      venueName: true,
      venueAddress: true,
      submittedAt: true,
      businessRegistrationCertificate: { select: { status: true } },
      court: { select: { id: true, name: true, address: true, status: true } },
    },
    orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
    take: query.limit + 1,
  });
  const hasNext = applications.length > query.limit;
  const items = hasNext ? applications.slice(0, query.limit) : applications;
  const lastItem = items.at(-1);

  return {
    items: items.map(toInternalReviewApplicationView),
    pageInfo: { nextCursor: hasNext && lastItem ? createInternalReviewCursor(lastItem) : null, hasNext },
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
  return prisma.$transaction(async (transaction) => {
    const stillActive = await transaction.courtOperatorApplication.findFirst({
      where: { applicantUserId: viewer.id, status: { in: [...activeOperatorApplicationStatuses] } },
      select: { id: true },
    });
    if (stillActive) throw new DomainError("OPERATOR_APPLICATION_ALREADY_ACTIVE", 409, "진행 중인 운영자 신청이 있어요.");

    await claimBusinessRegistrationCertificate(transaction, viewer.id, input.businessRegistrationCertificateUploadId, now);
    return transaction.courtOperatorApplication.create({
      data: {
        applicantUserId: viewer.id,
        status: decision.status,
        businessName: input.businessName,
        businessRegistrationNumberHash: createBusinessRegistrationNumberHash(input.businessRegistrationNumber),
        businessRegistrationCertificateUploadId: input.businessRegistrationCertificateUploadId,
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
  });
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

export async function reviewOperatorApplication(
  prisma: PrismaClient,
  reviewer: { id: string; role: string },
  applicationId: string,
  input: OperatorApplicationReviewInput,
) {
  assertInternalReviewer(reviewer);

  try {
    return await prisma.$transaction(async (transaction) => {
      const current = await transaction.courtOperatorApplication.findUnique({
        where: { id: applicationId },
        select: {
          applicantUserId: true,
          normalizedVenueKey: true,
          status: true,
          businessRegistrationCertificateUploadId: true,
          businessRegistrationCertificate: { select: { status: true } },
        },
      });
      if (!current) throw new DomainError("OPERATOR_APPLICATION_NOT_FOUND", 404, "운영자 신청을 찾을 수 없어요.");
      if (current.applicantUserId === reviewer.id) {
        throw new DomainError("INTERNAL_REVIEWER_SELF_REVIEW_FORBIDDEN", 403, "자신의 운영자 신청은 심사할 수 없어요.");
      }
      if (current.status !== "REVIEW_REQUIRED") {
        throw new DomainError("OPERATOR_APPLICATION_STATE_CONFLICT", 409, "최신 심사 상태를 다시 확인해 주세요.");
      }

      if (input.decision === "APPROVE_PUBLISH") {
        if (current.businessRegistrationCertificate?.status !== "ATTACHED") {
          throw new DomainError("BUSINESS_REGISTRATION_CERTIFICATE_REQUIRED", 409, "사업자등록증을 다시 제출해 주세요.");
        }
        const activeVenue = await transaction.courtOperatorApplication.findFirst({
          where: {
            normalizedVenueKey: current.normalizedVenueKey,
            status: "PUBLISH_APPROVED",
            NOT: { id: applicationId },
          },
          select: { id: true },
        });
        if (activeVenue) throw new DomainError("VENUE_ALREADY_ACTIVE", 409, "같은 장소에서 이미 승인된 운영자가 있어요.");
      }

      const now = new Date();
      const update = await transaction.courtOperatorApplication.updateMany({
        where: { id: applicationId, status: "REVIEW_REQUIRED" },
        data: input.decision === "APPROVE_PUBLISH"
          ? {
              status: "PUBLISH_APPROVED",
              businessVerificationStatus: "VERIFIED",
              venueVerificationStatus: "MATCHED",
              verificationFailureCode: null,
              verifiedAt: now,
              publishApprovedAt: now,
            }
          : {
              status: input.decision === "REQUEST_CHANGES" ? "CHANGES_REQUESTED" : "REJECTED",
              verificationFailureCode: input.reasonCode,
            },
      });
      if (update.count !== 1) {
        throw new DomainError("OPERATOR_APPLICATION_STATE_CONFLICT", 409, "최신 심사 상태를 다시 확인해 주세요.");
      }

      if (input.decision !== "REQUEST_CHANGES") {
        await expireBusinessRegistrationCertificate(transaction, current.businessRegistrationCertificateUploadId, now);
      }

      await transaction.operatorApplicationReview.create({
        data: {
          applicationId,
          reviewerUserId: reviewer.id,
          decision: input.decision,
          reasonCode: input.reasonCode,
        },
      });
      const reviewed = await transaction.courtOperatorApplication.findUnique({
        where: { id: applicationId },
        include: operatorApplicationInclude,
      });
      if (!reviewed) throw new DomainError("OPERATOR_APPLICATION_NOT_FOUND", 404, "운영자 신청을 찾을 수 없어요.");
      return reviewed;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new DomainError("VENUE_ALREADY_ACTIVE", 409, "같은 장소에서 이미 승인된 운영자가 있어요.");
    }
    throw error;
  }
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
  return prisma.$transaction(async (transaction) => {
    const latest = await transaction.courtOperatorApplication.findFirst({
      where: { id: applicationId, applicantUserId: viewer.id },
      select: { status: true, businessRegistrationCertificateUploadId: true },
    });
    if (!latest || !["REVIEW_REQUIRED", "CHANGES_REQUESTED", "REJECTED"].includes(latest.status)) {
      throw new DomainError("OPERATOR_APPLICATION_STATE_CONFLICT", 409, "현재 상태에서는 정보를 수정할 수 없어요.");
    }

    const { replacedUploadId } = await claimBusinessRegistrationCertificate(
      transaction,
      viewer.id,
      input.businessRegistrationCertificateUploadId,
      now,
      latest.businessRegistrationCertificateUploadId,
    );
    const update = await transaction.courtOperatorApplication.updateMany({
      where: { id: applicationId, applicantUserId: viewer.id, status: latest.status },
      data: {
        status: decision.status,
        businessName: input.businessName,
        businessRegistrationNumberHash: createBusinessRegistrationNumberHash(input.businessRegistrationNumber),
        businessRegistrationCertificateUploadId: input.businessRegistrationCertificateUploadId,
        businessVerificationStatus: decision.businessVerificationStatus,
        venueVerificationStatus: decision.venueVerificationStatus,
        venueName: input.venueName,
        venueAddress: input.venueAddress,
        normalizedVenueKey,
        verificationFailureCode: decision.verificationFailureCode,
        submittedAt: now,
        verifiedAt: decision.businessVerificationStatus === "VERIFIED" ? now : null,
        publishApprovedAt: decision.status === "PUBLISH_APPROVED" ? now : null,
      },
    });
    if (update.count !== 1) {
      throw new DomainError("OPERATOR_APPLICATION_STATE_CONFLICT", 409, "최신 심사 상태를 다시 확인해 주세요.");
    }
    await replaceClaimedBusinessRegistrationCertificate(transaction, viewer.id, replacedUploadId, now);
    await transaction.operatorApplicationVerificationAttempt.createMany({
      data: [
        { applicationId, kind: "BUSINESS", result: verification.business === "VERIFIED" ? "VERIFIED" : verification.business, safeFailureCode: decision.verificationFailureCode, providerRequestRef: verification.providerRequestRef },
        { applicationId, kind: "VENUE", result: verification.venue === "MATCHED" ? "VERIFIED" : verification.venue, safeFailureCode: decision.verificationFailureCode, providerRequestRef: verification.providerRequestRef },
      ],
    });
    const updated = await transaction.courtOperatorApplication.findUnique({ where: { id: applicationId }, include: operatorApplicationInclude });
    if (!updated) throw new DomainError("OPERATOR_APPLICATION_NOT_FOUND", 404, "운영자 신청을 찾을 수 없어요.");
    return updated;
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
