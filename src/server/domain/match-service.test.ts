import { Prisma } from "@/generated/prisma/client";
import { describe, expect, it, vi } from "vitest";

import { matchCreateInputSchema } from "./match";
import { createMatch, getMatchDetail, getMatches, reconcileStartedMatches, rejectApplication } from "./match-service";

const futureStartsAt = new Date("2030-01-02T01:00:00.000Z");
const futureEndsAt = new Date("2030-01-02T03:00:00.000Z");

const viewer = {
  id: "host-user-id",
  profile: {
    id: "profile-id",
    userId: "host-user-id",
    experienceRange: "YEARS_1_TO_2",
    rallyLevel: "SHORT_RALLY",
    gameExperience: "NONE",
    nearbyRegionAllowed: true,
    version: 1,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    regions: [{ tennisProfileId: "profile-id", regionCode: "SEOUL-001", isPrimary: true, region: { code: "SEOUL-001", parentCode: "SEOUL", name: "마포구", shortName: null, type: "DISTRICT", active: true } }],
    purposes: [{ tennisProfileId: "profile-id", purpose: "RALLY_PRACTICE" }],
  },
} as Parameters<typeof createMatch>[1];

const input = matchCreateInputSchema.parse({
  clientRequestId: "e3e70682-c209-4cac-a29f-6fbed82c07cd",
  title: "천천히 랠리 연습해요",
  startsAt: futureStartsAt.toISOString(),
  endsAt: futureEndsAt.toISOString(),
  regionCode: "SEOUL-001",
  courtSource: "COURT_TBD",
  externalCourt: null,
  recruitCount: 1,
  playPurposes: ["RALLY_PRACTICE"],
  partnerPreference: "COMPLETE_BEGINNER_WELCOME",
  totalCourtFeeKrw: null,
  additionalCostNote: null,
  introduction: "처음이라 천천히 랠리하고 싶어요.",
  contactOpenChatUrl: "https://open.kakao.com/o/example",
});

function makeMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: "match-id",
    hostUserId: "host-user-id",
    clientRequestId: input.clientRequestId,
    regionCode: "SEOUL-001",
    title: input.title,
    startsAt: futureStartsAt,
    endsAt: futureEndsAt,
    courtSource: "COURT_TBD",
    externalCourtName: null,
    externalCourtAddress: null,
    externalCourtNumber: null,
    externalCourtImageUploadId: null,
    courtSlotId: null,
    externalCourtImageUpload: null,
    courtSlot: null,
    recruitCount: 1,
    partnerPreference: "COMPLETE_BEGINNER_WELCOME",
    totalCourtFeeKrw: null,
    additionalCostNote: null,
    introduction: input.introduction,
    contactOpenChatUrl: input.contactOpenChatUrl,
    status: "OPEN",
    version: 1,
    closedAt: null,
    completedAt: null,
    expiredAt: null,
    cancelledAt: null,
    cancellationReason: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    region: { code: "SEOUL-001", parentCode: "SEOUL", name: "마포구", shortName: null, type: "DISTRICT", active: true },
    purposes: [{ purpose: "RALLY_PRACTICE" }],
    host: { id: "host-user-id", nickname: "테스트모집자", tennisProfile: viewer.profile },
    applications: [],
    ...overrides,
  };
}

describe("match service operation safeguards", () => {
  it("returns the concurrently created match when the same client request retries after a unique conflict", async () => {
    const existing = makeMatch();
    const findUnique = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce({ id: existing.id, status: "OPEN", startsAt: futureStartsAt, applications: [] })
      .mockResolvedValueOnce(existing);
    const prisma = {
      region: { findFirst: vi.fn().mockResolvedValue({ code: "SEOUL-001" }) },
      match: {
        findUnique,
        create: vi.fn().mockRejectedValue(new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "test" })),
      },
      matchSupplyNoticeRecipient: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (transaction: unknown) => unknown) => callback(prisma)),
    } as unknown as Parameters<typeof createMatch>[0];

    const result = await createMatch(prisma, viewer, input);

    expect(result).toMatchObject({ created: false, match: { id: existing.id } });
    expect(prisma.match.create).toHaveBeenCalledOnce();
    expect(findUnique).toHaveBeenCalledTimes(4);
  });

  it("does not reject a pending application after its match has started", async () => {
    const matchApplicationUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const transaction = {
      matchApplication: {
        findUnique: vi.fn().mockResolvedValue({ id: "application-id", status: "PENDING", match: { id: "match-id", hostUserId: viewer.id } }),
        updateMany: matchApplicationUpdateMany,
      },
      match: {
        findUnique: vi.fn()
          .mockResolvedValueOnce({ id: "match-id", status: "OPEN", startsAt: new Date("2026-01-01T00:00:00.000Z"), applications: [] })
          .mockResolvedValueOnce({ status: "EXPIRED", startsAt: new Date("2026-01-01T00:00:00.000Z") }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = { $transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)) } as unknown as Parameters<typeof rejectApplication>[0];

    await expect(rejectApplication(prisma, viewer, "application-id")).rejects.toMatchObject({
      code: "MATCH_STATE_CONFLICT",
      status: 409,
    });
    expect(matchApplicationUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "CANCELLED" }),
    }));
    expect(matchApplicationUpdateMany).toHaveBeenCalledOnce();
  });

  it("does not attach another user's or an already-claimed court image", async () => {
    const imageInput = matchCreateInputSchema.parse({
      ...input,
      clientRequestId: "e3e70682-c209-4cac-a29f-6fbed82c07ce",
      courtSource: "EXTERNAL_RESERVED",
      externalCourt: { name: "마포 테니스장", address: "서울 마포구 월드컵로 00", imageUploadId: "e3e70682-c209-4cac-a29f-6fbed82c07cf" },
      totalCourtFeeKrw: 40000,
      additionalCostNote: null,
    });
    const transaction = {
      courtImageUpload: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      match: { create: vi.fn() },
    };
    const prisma = {
      region: { findFirst: vi.fn().mockResolvedValue({ code: "SEOUL-001" }) },
      match: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)),
    } as unknown as Parameters<typeof createMatch>[0];

    await expect(createMatch(prisma, viewer, imageInput)).rejects.toMatchObject({
      code: "COURT_IMAGE_UPLOAD_UNAVAILABLE",
      status: 409,
    });
    expect(transaction.match.create).not.toHaveBeenCalled();
  });

  it("atomically claims a pending court image when it creates the match", async () => {
    const imageUploadId = "e3e70682-c209-4cac-a29f-6fbed82c07cf";
    const courtName = "마포 테니스장";
    const courtAddress = "서울 마포구 월드컵로 00";
    const imageInput = matchCreateInputSchema.parse({
      ...input,
      clientRequestId: "e3e70682-c209-4cac-a29f-6fbed82c07cd",
      courtSource: "EXTERNAL_RESERVED",
      externalCourt: { name: courtName, address: courtAddress, imageUploadId },
      totalCourtFeeKrw: 40000,
      additionalCostNote: null,
    });
    const createdMatch = makeMatch({
      id: "created-match-id",
      clientRequestId: imageInput.clientRequestId,
      courtSource: "EXTERNAL_RESERVED",
      externalCourtName: courtName,
      externalCourtAddress: courtAddress,
      externalCourtImageUploadId: imageUploadId,
      externalCourtImageUpload: { id: imageUploadId },
      totalCourtFeeKrw: 40_000,
    });
    const transaction = {
      courtImageUpload: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      match: {
        create: vi.fn().mockResolvedValue({ id: createdMatch.id }),
        findUnique: vi.fn().mockResolvedValue({ id: createdMatch.id, status: "OPEN", startsAt: futureStartsAt, applications: [] }),
      },
      matchApplication: { updateMany: vi.fn() },
    };
    const prisma = {
      region: { findFirst: vi.fn().mockResolvedValue({ code: "SEOUL-001" }) },
      match: { findUnique: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(createdMatch) },
      matchSupplyNoticeRecipient: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)),
    } as unknown as Parameters<typeof createMatch>[0];

    await expect(createMatch(prisma, viewer, imageInput)).resolves.toMatchObject({ created: true, match: { id: createdMatch.id } });
    expect(transaction.courtImageUpload.updateMany).toHaveBeenCalledWith({
      where: { id: imageUploadId, ownerUserId: viewer.id, status: "PENDING" },
      data: { status: "ATTACHED", attachedAt: expect.any(Date) },
    });
    expect(transaction.match.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ externalCourtImageUploadId: imageUploadId }),
    }));
  });

  it("derives partner court match fields from one available public slot and allocates it atomically", async () => {
    const partnerSlotId = "e3e70682-c209-4cac-a29f-6fbed82c07ce";
    const partnerInput = matchCreateInputSchema.parse({
      clientRequestId: "e3e70682-c209-4cac-a29f-6fbed82c07cf",
      courtSource: "PARTNER_COURT",
      courtSlotId: partnerSlotId,
      title: "제휴 코트에서 랠리해요",
      recruitCount: 2,
      playPurposes: ["RALLY_PRACTICE"],
      partnerPreference: "SIMILAR_LEVEL",
      contactOpenChatUrl: "https://open.kakao.com/o/example",
    });
    const courtSlot = {
      id: partnerSlotId,
      visibility: "PUBLIC",
      status: "AVAILABLE",
      startsAt: futureStartsAt,
      endsAt: futureEndsAt,
      priceKrw: 40_000,
      maxParticipantCount: 3,
      courtUnit: {
        name: "2번 코트",
        court: { regionCode: "SEOUL-001", status: "ACTIVE", operatorApplication: { id: "operator-application-id", status: "PUBLISH_APPROVED" } },
      },
    };
    const createdMatch = makeMatch({
      id: "partner-match-id",
      clientRequestId: partnerInput.clientRequestId,
      courtSource: "PARTNER_COURT",
      courtSlotId: courtSlot.id,
      totalCourtFeeKrw: courtSlot.priceKrw,
      courtSlot: {
        id: courtSlot.id,
        courtUnit: { name: courtSlot.courtUnit.name, court: { name: "마포 테니스파크", address: "서울 마포구", regionCode: "SEOUL-001", status: "ACTIVE", operatorApplication: { status: "PUBLISH_APPROVED" } } },
      },
    });
    const transaction = {
      courtSlot: {
        findUnique: vi.fn().mockResolvedValue(courtSlot),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      courtSlotStatusHistory: { create: vi.fn().mockResolvedValue({ id: "history-id" }) },
      operatorSupplyRestriction: { findFirst: vi.fn().mockResolvedValue(null) },
      match: {
        create: vi.fn().mockResolvedValue({ id: createdMatch.id }),
        findUnique: vi.fn().mockResolvedValue({ id: createdMatch.id, status: "OPEN", startsAt: futureStartsAt, applications: [] }),
      },
      matchApplication: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    };
    const findUnique = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(createdMatch);
    const prisma = {
      match: { findUnique },
      matchSupplyNoticeRecipient: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)),
    } as unknown as Parameters<typeof createMatch>[0];

    await expect(createMatch(prisma, viewer, partnerInput)).resolves.toMatchObject({ created: true, match: { id: createdMatch.id } });
    expect(transaction.courtSlot.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: partnerSlotId, status: "AVAILABLE", visibility: "PUBLIC" }),
      data: expect.objectContaining({ status: "ALLOCATED" }),
    }));
    expect(transaction.match.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        courtSource: "PARTNER_COURT",
        courtSlotId: partnerSlotId,
        regionCode: "SEOUL-001",
        startsAt: futureStartsAt,
        endsAt: futureEndsAt,
        totalCourtFeeKrw: 40_000,
      }),
    }));
    expect(transaction.courtSlotStatusHistory.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ actor: "SESSION_HOST", toStatus: "ALLOCATED" }),
    }));
  });

  it("does not allocate a partner slot when the participant limit would be exceeded", async () => {
    const partnerSlotId = "e3e70682-c209-4cac-a29f-6fbed82c07ce";
    const partnerInput = matchCreateInputSchema.parse({
      clientRequestId: "e3e70682-c209-4cac-a29f-6fbed82c07cf",
      courtSource: "PARTNER_COURT",
      courtSlotId: partnerSlotId,
      title: "제휴 코트에서 랠리해요",
      recruitCount: 2,
      playPurposes: ["RALLY_PRACTICE"],
      partnerPreference: "SIMILAR_LEVEL",
      contactOpenChatUrl: "https://open.kakao.com/o/example",
    });
    const transaction = {
      courtSlot: {
        findUnique: vi.fn().mockResolvedValue({
          id: partnerSlotId,
          visibility: "PUBLIC",
          status: "AVAILABLE",
          startsAt: futureStartsAt,
          endsAt: futureEndsAt,
          priceKrw: 40_000,
          maxParticipantCount: 2,
          courtUnit: { court: { regionCode: "SEOUL-001", status: "ACTIVE", operatorApplication: { status: "PUBLISH_APPROVED" } } },
        }),
        updateMany: vi.fn(),
      },
      match: { create: vi.fn() },
    };
    const prisma = {
      match: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)),
    } as unknown as Parameters<typeof createMatch>[0];

    await expect(createMatch(prisma, viewer, partnerInput)).rejects.toMatchObject({ code: "PARTNER_SLOT_CAPACITY_EXCEEDED", status: 409 });
    expect(transaction.courtSlot.updateMany).not.toHaveBeenCalled();
    expect(transaction.match.create).not.toHaveBeenCalled();
  });

  it("does not allocate a partner session from an inactive court", async () => {
    const partnerInput = matchCreateInputSchema.parse({
      clientRequestId: "e3e70682-c209-4cac-a29f-6fbed82c07aa",
      courtSource: "PARTNER_COURT",
      courtSlotId: "e3e70682-c209-4cac-a29f-6fbed82c07ab",
      title: "제휴 코트에서 랠리해요",
      recruitCount: 1,
      playPurposes: ["RALLY_PRACTICE"],
      partnerPreference: "SIMILAR_LEVEL",
      contactOpenChatUrl: "https://open.kakao.com/o/example",
    });
    const transaction = {
      courtSlot: {
        findUnique: vi.fn().mockResolvedValue({
          id: "e3e70682-c209-4cac-a29f-6fbed82c07ab",
          visibility: "PUBLIC",
          status: "AVAILABLE",
          startsAt: futureStartsAt,
          endsAt: futureEndsAt,
          priceKrw: 40_000,
          maxParticipantCount: 3,
          courtUnit: { court: { regionCode: "SEOUL-001", status: "INACTIVE", operatorApplication: { id: "operator-application-id", status: "PUBLISH_APPROVED" } } },
        }),
        updateMany: vi.fn(),
      },
      match: { create: vi.fn() },
    };
    const prisma = {
      match: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)),
    } as unknown as Parameters<typeof createMatch>[0];

    await expect(createMatch(prisma, viewer, partnerInput)).rejects.toMatchObject({ code: "PARTNER_SLOT_NOT_AVAILABLE", status: 409 });
    expect(transaction.courtSlot.updateMany).not.toHaveBeenCalled();
    expect(transaction.match.create).not.toHaveBeenCalled();
  });

  it("rejects a competing partner session after another request conditionally allocates the same slot", async () => {
    const partnerSlotId = "e3e70682-c209-4cac-a29f-6fbed82c07ce";
    const partnerInput = matchCreateInputSchema.parse({
      clientRequestId: "e3e70682-c209-4cac-a29f-6fbed82c07cf",
      courtSource: "PARTNER_COURT",
      courtSlotId: partnerSlotId,
      title: "제휴 코트에서 랠리해요",
      recruitCount: 2,
      playPurposes: ["RALLY_PRACTICE"],
      partnerPreference: "SIMILAR_LEVEL",
      contactOpenChatUrl: "https://open.kakao.com/o/example",
    });
    const transaction = {
      courtSlot: {
        findUnique: vi.fn().mockResolvedValue({
          id: partnerSlotId,
          visibility: "PUBLIC",
          status: "AVAILABLE",
          startsAt: futureStartsAt,
          endsAt: futureEndsAt,
          priceKrw: 40_000,
          maxParticipantCount: 3,
          courtUnit: { court: { regionCode: "SEOUL-001", status: "ACTIVE", operatorApplication: { id: "operator-application-id", status: "PUBLISH_APPROVED" } } },
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      operatorSupplyRestriction: { findFirst: vi.fn().mockResolvedValue(null) },
      courtSlotStatusHistory: { create: vi.fn() },
      match: { create: vi.fn() },
    };
    const prisma = {
      match: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)),
    } as unknown as Parameters<typeof createMatch>[0];

    await expect(createMatch(prisma, viewer, partnerInput)).rejects.toMatchObject({
      code: "PARTNER_SLOT_ALREADY_ALLOCATED",
      status: 409,
    });
    expect(transaction.match.create).not.toHaveBeenCalled();
  });

  it("asks the database to exclude the viewer's matches and prior applications from discovery", async () => {
    const findMany = vi.fn().mockResolvedValue([makeMatch({ id: "other-match-id", hostUserId: "other-user-id", host: { id: "other-user-id", nickname: "다른모집자", tennisProfile: viewer.profile } })]);
    const prisma = { match: { findMany } } as unknown as Parameters<typeof getMatches>[0];

    await getMatches(prisma, viewer, { startsFrom: new Date("2029-01-01T00:00:00.000Z"), limit: 20 });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        NOT: [
          { hostUserId: viewer.id },
          { applications: { some: { applicantUserId: viewer.id } } },
        ],
      }),
    }));
  });

  it("shows a partner court facility photo through the protected route in match detail", async () => {
    const match = makeMatch({
      courtSource: "PARTNER_COURT",
      courtSlotId: "slot-id",
      totalCourtFeeKrw: 40_000,
      courtSlot: {
        id: "slot-id",
        courtUnit: {
          name: "2번 코트",
          court: { id: "court-id", name: "마포 테니스파크", address: "서울 마포구", status: "ACTIVE", operatorApplication: { status: "PUBLISH_APPROVED" }, images: [{ id: "representative-image-id" }] },
        },
      },
    });
    const transaction = {
      match: { findUnique: vi.fn().mockResolvedValue({ id: "match-id", status: "OPEN", startsAt: futureStartsAt, applications: [] }) },
      matchApplication: { updateMany: vi.fn() },
    };
    const prisma = {
      match: { findUnique: vi.fn().mockResolvedValue(match) },
      matchSupplyNoticeRecipient: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)),
    } as unknown as Parameters<typeof getMatchDetail>[0];

    await expect(getMatchDetail(prisma, viewer, "match-id")).resolves.toMatchObject({
      court: {
        source: "PARTNER_COURT",
        sourceLabel: "Tennis Mate에서 준비한 코트예요",
        image: {
          url: "/api/v1/partner-courts/court-id/image",
          sourceLabel: "운영자 제공 사진",
        },
      },
    });
  });

  it("reports the started matches transitioned by the shared reconciliation function", async () => {
    const transaction = {
      match: {
        findUnique: vi.fn().mockResolvedValue({
          id: "started-match-id",
          status: "OPEN",
          startsAt: new Date("2026-01-01T00:00:00.000Z"),
          applications: [],
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      matchApplication: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    };
    const prisma = {
      match: { findMany: vi.fn().mockResolvedValue([{ id: "started-match-id" }]) },
      $transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)),
    } as unknown as Parameters<typeof reconcileStartedMatches>[0];

    await expect(reconcileStartedMatches(prisma, new Date("2026-01-01T01:00:00.000Z"))).resolves.toEqual({
      checked: 1,
      closed: 0,
      expired: 1,
    });
    expect(transaction.matchApplication.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "CANCELLED" }),
    }));
  });
});
