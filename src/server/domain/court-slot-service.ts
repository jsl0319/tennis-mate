import { Prisma } from "@/generated/prisma/client";
import type { CourtSlotStatus, PrismaClient } from "@/generated/prisma/client";

import { DomainError } from "@/server/domain/profile-service";

import type { CourtCreateInput, CourtSlotCreateInput } from "./court-slot";

const draftAccessStatuses = ["DRAFT_ACCESS_GRANTED", "PUBLISH_APPROVED"] as const;

const courtInclude = {
  region: true,
  units: { orderBy: { name: "asc" } },
  operatorApplication: { select: { applicantUserId: true, status: true } },
} satisfies Prisma.CourtInclude;

const courtSlotInclude = {
  courtUnit: {
    include: {
      court: {
        include: {
          region: true,
          operatorApplication: { select: { applicantUserId: true, status: true } },
        },
      },
    },
  },
  match: { select: { id: true, status: true } },
} satisfies Prisma.CourtSlotInclude;

type CourtWithRelations = Prisma.CourtGetPayload<{ include: typeof courtInclude }>;
type CourtSlotWithRelations = Prisma.CourtSlotGetPayload<{ include: typeof courtSlotInclude }>;

const slotStatusLabels: Record<CourtSlotStatus, string> = {
  DRAFT: "비공개 초안",
  AVAILABLE: "세션 열기 가능",
  ALLOCATED: "세션 모집 중",
  ENDED: "종료됨",
  BLOCKED: "운영자가 중지했어요",
  CANCELLED: "취소됨",
};

function optionalText(value: string | null | undefined) {
  return value?.trim() || null;
}

function canCreatePrivateDraft(status: string) {
  return draftAccessStatuses.includes(status as (typeof draftAccessStatuses)[number]);
}

function canPublish(status: string) {
  return status === "PUBLISH_APPROVED";
}

function toCourtView(court: CourtWithRelations) {
  return {
    id: court.id,
    name: court.name,
    address: court.address,
    region: { code: court.region.code, name: court.region.name },
    operatorApplicationStatus: court.operatorApplication.status,
    units: court.units.map((unit) => ({ id: unit.id, name: unit.name })),
    createdAt: court.createdAt.toISOString(),
    updatedAt: court.updatedAt.toISOString(),
  };
}

export function toCourtSlotView(slot: CourtSlotWithRelations, now = new Date()) {
  const canOpenSession = slot.status === "AVAILABLE" && slot.startsAt > now;
  const session = slot.match
    ? { matchId: slot.match.id, status: slot.match.status }
    : null;

  return {
    id: slot.id,
    visibility: slot.visibility,
    status: slot.status,
    statusLabel: slotStatusLabels[slot.status],
    statusChangedAt: slot.statusChangedAt.toISOString(),
    startsAt: slot.startsAt.toISOString(),
    endsAt: slot.endsAt.toISOString(),
    totalCourtFeeKrw: slot.priceKrw,
    maxParticipantCount: slot.maxParticipantCount,
    usageNote: slot.usageNote,
    court: {
      id: slot.courtUnit.court.id,
      name: slot.courtUnit.court.name,
      address: slot.courtUnit.court.address,
      courtNumber: slot.courtUnit.name,
      region: { code: slot.courtUnit.court.region.code, name: slot.courtUnit.court.region.name },
    },
    session,
    availableAction: canOpenSession ? "OPEN_SESSION" : session ? "VIEW_SESSION" : "READ_ONLY",
    version: slot.version,
  };
}

async function getDraftAccessApplication(prisma: PrismaClient, userId: string) {
  const application = await prisma.courtOperatorApplication.findFirst({
    where: { applicantUserId: userId, status: { in: [...draftAccessStatuses] } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      venueName: true,
      venueAddress: true,
      normalizedVenueKey: true,
    },
  });
  if (!application) {
    throw new DomainError("OPERATOR_DRAFT_ACCESS_REQUIRED", 403, "코트와 시간대 초안을 만들 수 있는 운영자 확인이 필요해요.");
  }
  return application;
}

async function getOwnedCourt(prisma: PrismaClient, viewer: { id: string }, courtId: string) {
  const court = await prisma.court.findFirst({
    where: { id: courtId, operatorApplication: { applicantUserId: viewer.id } },
    include: courtInclude,
  });
  if (!court) throw new DomainError("COURT_NOT_FOUND", 404, "코트장을 찾을 수 없어요.");
  if (!canCreatePrivateDraft(court.operatorApplication.status)) {
    throw new DomainError("OPERATOR_DRAFT_ACCESS_REQUIRED", 403, "현재 상태에서는 코트 시간대 초안을 만들 수 없어요.");
  }
  return court;
}

async function getOwnedCourtSlot(prisma: PrismaClient, viewer: { id: string }, slotId: string) {
  const slot = await prisma.courtSlot.findFirst({
    where: {
      id: slotId,
      courtUnit: { court: { operatorApplication: { applicantUserId: viewer.id } } },
    },
    include: courtSlotInclude,
  });
  if (!slot) throw new DomainError("COURT_SLOT_NOT_FOUND", 404, "코트 시간대를 찾을 수 없어요.");
  return slot;
}

function assertPublishAccess(slot: CourtSlotWithRelations) {
  if (!canPublish(slot.courtUnit.court.operatorApplication.status)) {
    throw new DomainError("OPERATOR_PUBLISH_APPROVAL_REQUIRED", 403, "공개하려면 운영자 공개 승인이 필요해요.");
  }
}

function isOverlapConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.message.includes("court_slots_unit_time_no_overlap");
}

export async function getMyCourts(prisma: PrismaClient, viewer: { id: string }) {
  const courts = await prisma.court.findMany({
    where: { operatorApplication: { applicantUserId: viewer.id } },
    include: courtInclude,
    orderBy: { createdAt: "desc" },
  });
  return { items: courts.map(toCourtView) };
}

export async function createCourt(prisma: PrismaClient, viewer: { id: string }, input: CourtCreateInput) {
  const application = await getDraftAccessApplication(prisma, viewer.id);
  const region = await prisma.region.findFirst({
    where: { code: input.regionCode, active: true, type: "DISTRICT" },
    select: { code: true },
  });
  if (!region) throw new DomainError("INVALID_REGION", 422, "활성화된 시·군·구를 선택해 주세요.");

  const existing = await prisma.court.findUnique({ where: { operatorApplicationId: application.id }, select: { id: true } });
  if (existing) throw new DomainError("COURT_ALREADY_EXISTS", 409, "이 운영자 신청에 연결된 코트장이 이미 있어요.");

  try {
    const court = await prisma.court.create({
      data: {
        operatorApplicationId: application.id,
        regionCode: region.code,
        name: application.venueName,
        address: application.venueAddress,
        normalizedVenueKey: application.normalizedVenueKey,
      },
      include: courtInclude,
    });
    return toCourtView(court);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new DomainError("COURT_ALREADY_EXISTS", 409, "이 운영자 신청에 연결된 코트장이 이미 있어요.");
    }
    throw error;
  }
}

export async function createCourtSlot(prisma: PrismaClient, viewer: { id: string }, courtId: string, input: CourtSlotCreateInput) {
  await getOwnedCourt(prisma, viewer, courtId);
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);

  try {
    return await prisma.$transaction(async (transaction) => {
      const existingUnit = await transaction.courtUnit.findUnique({
        where: { courtId_name: { courtId, name: input.courtUnitName } },
      });
      const courtUnit = existingUnit ?? await transaction.courtUnit.create({ data: { courtId, name: input.courtUnitName } });

      const overlap = await transaction.courtSlot.findFirst({
        where: {
          courtUnitId: courtUnit.id,
          status: { in: ["DRAFT", "AVAILABLE", "ALLOCATED"] },
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
        select: { id: true },
      });
      if (overlap) throw new DomainError("COURT_SLOT_OVERLAP", 409, "같은 코트 면에 겹치는 시간대가 있어요.");

      const now = new Date();
      const slot = await transaction.courtSlot.create({
        data: {
          courtUnitId: courtUnit.id,
          startsAt,
          endsAt,
          priceKrw: input.priceKrw,
          maxParticipantCount: input.maxParticipantCount,
          usageNote: optionalText(input.usageNote),
          statusChangedAt: now,
          statusHistory: {
            create: {
              fromStatus: null,
              toStatus: "DRAFT",
              actor: "OPERATOR",
              actorUserId: viewer.id,
              reasonCode: "SLOT_DRAFT_CREATED",
            },
          },
        },
        include: courtSlotInclude,
      });
      return toCourtSlotView(slot, now);
    });
  } catch (error) {
    if (isOverlapConstraintError(error)) {
      throw new DomainError("COURT_SLOT_OVERLAP", 409, "같은 코트 면에 겹치는 시간대가 있어요.");
    }
    throw error;
  }
}

async function transitionSlot(
  prisma: PrismaClient,
  viewer: { id: string },
  slotId: string,
  nextStatus: "AVAILABLE" | "BLOCKED",
) {
  const slot = await getOwnedCourtSlot(prisma, viewer, slotId);
  assertPublishAccess(slot);

  if (nextStatus === "AVAILABLE") {
    if (slot.status !== "DRAFT" || slot.visibility !== "PRIVATE") {
      throw new DomainError("COURT_SLOT_STATE_CONFLICT", 409, "비공개 초안 시간대만 공개할 수 있어요.");
    }
    if (slot.startsAt <= new Date()) {
      throw new DomainError("COURT_SLOT_ALREADY_STARTED", 409, "이미 시작된 시간대는 공개할 수 없어요.");
    }
  } else if (slot.status !== "AVAILABLE") {
    throw new DomainError("COURT_SLOT_STATE_CONFLICT", 409, "세션 열기 가능 상태의 시간대만 중지할 수 있어요.");
  }

  const now = new Date();
  const result = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.courtSlot.updateMany({
      where: {
        id: slot.id,
        status: slot.status,
        visibility: slot.visibility,
        version: slot.version,
      },
      data: {
        status: nextStatus,
        ...(nextStatus === "AVAILABLE" ? { visibility: "PUBLIC", publishedAt: now } : {}),
        statusChangedAt: now,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new DomainError("COURT_SLOT_STATE_CONFLICT", 409, "다른 변경사항이 있어 시간대를 다시 확인해 주세요.");
    }
    await transaction.courtSlotStatusHistory.create({
      data: {
        courtSlotId: slot.id,
        fromStatus: slot.status,
        toStatus: nextStatus,
        actor: "OPERATOR",
        actorUserId: viewer.id,
        reasonCode: nextStatus === "AVAILABLE" ? "SLOT_PUBLISHED" : "SLOT_BLOCKED_BY_OPERATOR",
      },
    });
    return transaction.courtSlot.findUniqueOrThrow({ where: { id: slot.id }, include: courtSlotInclude });
  });
  return toCourtSlotView(result, now);
}

export function publishCourtSlot(prisma: PrismaClient, viewer: { id: string }, slotId: string) {
  return transitionSlot(prisma, viewer, slotId, "AVAILABLE");
}

export function blockCourtSlot(prisma: PrismaClient, viewer: { id: string }, slotId: string) {
  return transitionSlot(prisma, viewer, slotId, "BLOCKED");
}

export async function getPublicCourtSlots(prisma: PrismaClient, availableOnly: boolean) {
  const now = new Date();
  const slots = await prisma.courtSlot.findMany({
    where: {
      visibility: "PUBLIC",
      ...(availableOnly ? { status: "AVAILABLE", startsAt: { gt: now } } : {}),
    },
    include: courtSlotInclude,
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
  });
  return { items: slots.map((slot) => toCourtSlotView(slot, now)) };
}
