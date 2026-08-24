import { Prisma } from "@/generated/prisma/client";
import { describe, expect, it, vi } from "vitest";

import { matchCreateInputSchema } from "./match";
import { createMatch, getMatches, reconcileStartedMatches, rejectApplication } from "./match-service";

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
