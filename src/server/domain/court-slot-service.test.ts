import { describe, expect, it, vi } from "vitest";

import { courtSlotCreateInputSchema } from "./court-slot";
import { createCourt, createCourtSlot, publishCourtSlot } from "./court-slot-service";

const viewer = { id: "operator-user-id" };
const futureStartsAt = new Date("2030-01-02T01:00:00.000Z");
const futureEndsAt = new Date("2030-01-02T03:00:00.000Z");

const slotInput = courtSlotCreateInputSchema.parse({
  courtUnitName: "2번 코트",
  startsAt: futureStartsAt.toISOString(),
  endsAt: futureEndsAt.toISOString(),
  priceKrw: 40_000,
  maxParticipantCount: 4,
  usageNote: "실내 전용 테니스화를 준비해 주세요.",
});

function ownedCourt(status: "DRAFT_ACCESS_GRANTED" | "PUBLISH_APPROVED" = "DRAFT_ACCESS_GRANTED") {
  return {
    id: "court-id",
    operatorApplicationId: "application-id",
    regionCode: "SEOUL-001",
    name: "마포 테니스파크",
    address: "서울특별시 마포구 월드컵로 00",
    normalizedVenueKey: "venue-key",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    region: { code: "SEOUL-001", name: "마포구" },
    units: [],
    operatorApplication: { applicantUserId: viewer.id, status },
  };
}

function ownedSlot(applicationStatus: "DRAFT_ACCESS_GRANTED" | "PUBLISH_APPROVED") {
  return {
    id: "slot-id",
    courtUnitId: "unit-id",
    startsAt: futureStartsAt,
    endsAt: futureEndsAt,
    priceKrw: 40_000,
    maxParticipantCount: 4,
    visibility: "PRIVATE",
    status: "DRAFT",
    publishedAt: null,
    statusChangedAt: new Date("2026-01-01T00:00:00.000Z"),
    usageNote: null,
    version: 1,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    courtUnit: {
      name: "2번 코트",
      court: {
        ...ownedCourt(applicationStatus),
        operatorApplication: { applicantUserId: viewer.id, status: applicationStatus },
      },
    },
    match: null,
  };
}

describe("Court Partner time supply authorization and state transitions", () => {
  it("rejects invalid or non-future time slots before persistence", () => {
    expect(() => courtSlotCreateInputSchema.parse({ ...slotInput, endsAt: slotInput.startsAt })).toThrow("종료 시간");
    expect(() => courtSlotCreateInputSchema.parse({ ...slotInput, startsAt: "2020-01-02T01:00:00.000Z" })).toThrow("시작 시간");
    expect(() => courtSlotCreateInputSchema.parse({ ...slotInput, maxParticipantCount: 1 })).toThrow("2명");
  });

  it("allows a draft-approved operator to create only a private slot draft with an audit record", async () => {
    const created = { ...ownedSlot("DRAFT_ACCESS_GRANTED"), statusChangedAt: new Date(), usageNote: slotInput.usageNote };
    const transaction = {
      courtUnit: { findUnique: vi.fn().mockResolvedValue({ id: "unit-id" }) },
      courtSlot: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(created),
      },
    };
    const prisma = {
      court: { findFirst: vi.fn().mockResolvedValue(ownedCourt()) },
      $transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)),
    } as unknown as Parameters<typeof createCourtSlot>[0];

    const result = await createCourtSlot(prisma, viewer, "court-id", slotInput);

    expect(result).toMatchObject({ id: "slot-id", visibility: "PRIVATE", status: "DRAFT", availableAction: "READ_ONLY" });
    expect(transaction.courtSlot.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        statusHistory: expect.objectContaining({ create: expect.objectContaining({ actor: "OPERATOR", toStatus: "DRAFT", reasonCode: "SLOT_DRAFT_CREATED" }) }),
      }),
    }));
  });

  it("requires publish approval before a private draft can become a public available slot", async () => {
    const prisma = {
      courtSlot: { findFirst: vi.fn().mockResolvedValue(ownedSlot("DRAFT_ACCESS_GRANTED")) },
      $transaction: vi.fn(),
    } as unknown as Parameters<typeof publishCourtSlot>[0];

    await expect(publishCourtSlot(prisma, viewer, "slot-id")).rejects.toMatchObject({
      code: "OPERATOR_PUBLISH_APPROVAL_REQUIRED",
      status: 403,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("does not create a court for a user without draft access", async () => {
    const prisma = {
      courtOperatorApplication: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as Parameters<typeof createCourt>[0];

    await expect(createCourt(prisma, viewer, { regionCode: "SEOUL-001" })).rejects.toMatchObject({
      code: "OPERATOR_DRAFT_ACCESS_REQUIRED",
      status: 403,
    });
  });
});
