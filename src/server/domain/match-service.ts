import type { PlayPurpose, Prisma, PrismaClient } from "@/generated/prisma/client";

import { getProfile, type ProfileWithRelations } from "@/server/domain/profile-service";
import { DomainError } from "@/server/domain/profile-service";

import {
  getAcceptedCount,
  getEstimatedFeePerPerson,
  getProfileLabels,
  getRecommendation,
  hasRemainingSpots,
  isDiscoverableMatch,
  matchStatusLabels,
  type MatchCreateInput,
  partnerPreferenceLabels,
  type RecommendationProfile,
} from "./match";

const matchInclude = {
  region: true,
  purposes: { select: { purpose: true } },
  host: {
    select: {
      id: true,
      nickname: true,
      tennisProfile: {
        include: {
          regions: { include: { region: true } },
          purposes: true,
        },
      },
    },
  },
  applications: { select: { id: true, applicantUserId: true, status: true } },
} satisfies Prisma.MatchInclude;

type MatchWithRelations = Prisma.MatchGetPayload<{ include: typeof matchInclude }>;

type Viewer = {
  id: string;
  profile: ProfileWithRelations;
};

function toRecommendationProfile(profile: ProfileWithRelations): RecommendationProfile {
  return {
    rallyLevel: profile.rallyLevel,
    gameExperience: profile.gameExperience,
    activityRegionCode: profile.regions.find((item) => item.isPrimary)?.regionCode ?? null,
    playPurposes: profile.purposes.map(({ purpose }) => purpose),
  };
}

function toHostProfile(profile: MatchWithRelations["host"]["tennisProfile"]): RecommendationProfile | null {
  if (!profile) return null;
  return {
    rallyLevel: profile.rallyLevel,
    gameExperience: profile.gameExperience,
    activityRegionCode: profile.regions.find((item) => item.isPrimary)?.regionCode ?? null,
    playPurposes: profile.purposes.map(({ purpose }) => purpose),
  };
}

function toProfileView(profile: MatchWithRelations["host"]["tennisProfile"]) {
  if (!profile) return null;
  const primaryRegion = profile.regions.find((item) => item.isPrimary)?.region;
  const { rallyLevelLabel, gameExperienceLabel } = getProfileLabels(profile);

  return {
    experienceRange: profile.experienceRange,
    experienceLabel: ({
      UNDER_3_MONTHS: "3개월 미만",
      MONTHS_3_TO_6: "3~6개월",
      MONTHS_6_TO_12: "6개월~1년",
      YEARS_1_TO_2: "1~2년",
      YEARS_2_PLUS: "2년 이상",
    } as const)[profile.experienceRange],
    rallyLevel: profile.rallyLevel,
    rallyLevelLabel,
    gameExperience: profile.gameExperience,
    gameExperienceLabel,
    playPurposes: profile.purposes.map(({ purpose }) => ({ code: purpose, label: ({
      CASUAL_HIT: "편하게 공 주고받기",
      RALLY_PRACTICE: "랠리",
      STROKE_PRACTICE: "스트로크 연습",
      GAME_INTRO: "게임 입문",
      GAME: "게임",
    } as const)[purpose] })),
    activityRegion: primaryRegion
      ? { code: primaryRegion.code, name: primaryRegion.name, parentCode: primaryRegion.parentCode }
      : null,
    nearbyRegionAllowed: profile.nearbyRegionAllowed,
  };
}

function getRecommendationForMatch(match: MatchWithRelations, viewer: Viewer) {
  return getRecommendation(toRecommendationProfile(viewer.profile), toHostProfile(match.host.tennisProfile), {
    partnerPreference: match.partnerPreference,
    playPurposes: match.purposes.map(({ purpose }) => purpose),
  });
}

function toMatchCardView(match: MatchWithRelations, viewer: Viewer) {
  const acceptedCount = getAcceptedCount(match.applications);
  const recommendation = getRecommendationForMatch(match, viewer);

  return {
    id: match.id,
    title: match.title,
    status: match.status,
    statusLabel: matchStatusLabels[match.status],
    startsAt: match.startsAt.toISOString(),
    endsAt: match.endsAt.toISOString(),
    region: { code: match.region.code, name: match.region.name },
    court: {
      source: match.courtSource,
      sourceLabel: "모집자가 코트를 예약했어요",
      name: match.externalCourtName,
    },
    playPurposes: match.purposes.map(({ purpose }) => ({ code: purpose, label: ({
      CASUAL_HIT: "편하게 공 주고받기",
      RALLY_PRACTICE: "랠리",
      STROKE_PRACTICE: "스트로크 연습",
      GAME_INTRO: "게임 입문",
      GAME: "게임",
    } as const)[purpose] })),
    partnerPreference: match.partnerPreference,
    beginnerWelcome: match.partnerPreference === "COMPLETE_BEGINNER_WELCOME",
    recruitCount: match.recruitCount,
    acceptedCount,
    remainingSpots: Math.max(match.recruitCount - acceptedCount, 0),
    estimatedTotalParticipants: match.recruitCount + 1,
    estimatedFeePerPersonKrw: getEstimatedFeePerPerson(match.totalCourtFeeKrw, match.recruitCount),
    recommendationReasons: recommendation.reasons,
  };
}

function toCursor(match: MatchWithRelations) {
  return Buffer.from(JSON.stringify({ startsAt: match.startsAt.toISOString(), id: match.id })).toString("base64url");
}

export function parseCursor(cursor: string) {
  try {
    const decoded: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (
      typeof decoded !== "object" || decoded === null ||
      typeof (decoded as { startsAt?: unknown }).startsAt !== "string" ||
      typeof (decoded as { id?: unknown }).id !== "string" ||
      Number.isNaN(new Date((decoded as { startsAt: string }).startsAt).getTime())
    ) throw new Error();
    return decoded as { startsAt: string; id: string };
  } catch {
    throw new DomainError("INVALID_REQUEST", 400, "목록을 다시 불러와 주세요.");
  }
}

export async function getOnboardedViewer(prisma: PrismaClient, user: { id: string; onboardingCompletedAt: Date | null }) {
  const profile = await getProfile(prisma, user.id);
  if (!user.onboardingCompletedAt || !profile) {
    throw new DomainError("ONBOARDING_REQUIRED", 403, "테니스 프로필을 먼저 완성해 주세요.");
  }
  return { id: user.id, profile } satisfies Viewer;
}

function filterDiscoverable(matches: MatchWithRelations[], now: Date) {
  return matches.filter((match) => isDiscoverableMatch({
    status: match.status,
    startsAt: match.startsAt,
    recruitCount: match.recruitCount,
    applications: match.applications,
    now,
  }));
}

export async function getRecommendedMatches(prisma: PrismaClient, viewer: Viewer, limit: number) {
  const now = new Date();
  const matches = await prisma.match.findMany({
    where: { status: "OPEN", startsAt: { gt: now }, NOT: { hostUserId: viewer.id } },
    include: matchInclude,
  });

  return filterDiscoverable(matches, now)
    .filter((match) => !match.applications.some((application) => application.applicantUserId === viewer.id))
    .map((match) => ({ match, recommendation: getRecommendationForMatch(match, viewer) }))
    .sort((left, right) => right.recommendation.score - left.recommendation.score || left.match.startsAt.getTime() - right.match.startsAt.getTime() || left.match.id.localeCompare(right.match.id))
    .slice(0, limit)
    .map(({ match }) => toMatchCardView(match, viewer));
}

export async function getMatches(
  prisma: PrismaClient,
  viewer: Viewer,
  input: { regionCode?: string; playPurpose?: PlayPurpose; startsFrom: Date; cursor?: { startsAt: string; id: string }; limit: number },
) {
  const cursorCondition = input.cursor
    ? {
        OR: [
          { startsAt: { gt: new Date(input.cursor.startsAt) } },
          { startsAt: new Date(input.cursor.startsAt), id: { gt: input.cursor.id } },
        ],
      }
    : undefined;
  const matches = await prisma.match.findMany({
    where: {
      status: "OPEN",
      startsAt: { gt: input.startsFrom },
      ...(input.regionCode ? { regionCode: input.regionCode } : {}),
      ...(input.playPurpose ? { purposes: { some: { purpose: input.playPurpose } } } : {}),
      ...cursorCondition,
    },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    include: matchInclude,
  });
  const items = filterDiscoverable(matches, new Date()).slice(0, input.limit + 1);
  const hasNext = items.length > input.limit;
  const visibleItems = hasNext ? items.slice(0, input.limit) : items;

  return {
    items: visibleItems.map((match) => toMatchCardView(match, viewer)),
    pageInfo: {
      nextCursor: hasNext && visibleItems.at(-1) ? toCursor(visibleItems.at(-1)!) : null,
      hasNext,
    },
  };
}

export async function getMatchDetail(prisma: PrismaClient, viewer: Viewer, matchId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId }, include: matchInclude });
  if (!match) throw new DomainError("MATCH_NOT_FOUND", 404, "매칭을 찾을 수 없어요.");

  const application = match.applications.find((item) => item.applicantUserId === viewer.id) ?? null;
  const relation = match.hostUserId === viewer.id ? "HOST" : application ? "APPLICANT" : "NONE";
  if (match.status !== "OPEN" && relation === "NONE") {
    throw new DomainError("MATCH_NOT_FOUND", 404, "매칭을 찾을 수 없어요.");
  }

  const now = new Date();
  const acceptedCount = getAcceptedCount(match.applications);
  const canApply = relation === "NONE" && match.status === "OPEN" && match.startsAt > now && hasRemainingSpots(match.recruitCount, match.applications);
  const applyBlockedReason = canApply
    ? null
    : relation === "HOST"
      ? "OWN_MATCH"
      : relation === "APPLICANT"
        ? "ALREADY_APPLIED"
        : match.status !== "OPEN"
          ? "MATCH_NOT_OPEN"
          : match.startsAt <= now
            ? "MATCH_STARTED"
            : "NO_REMAINING_SPOTS";
  const card = toMatchCardView(match, viewer);
  const recommendationReasons = relation === "HOST" ? [] : card.recommendationReasons;
  const canSeeContact = relation === "HOST" || application?.status === "ACCEPTED";

  return {
    ...card,
    recommendationReasons,
    court: {
      ...card.court,
      address: match.externalCourtAddress,
      courtNumber: match.externalCourtNumber,
    },
    totalCourtFeeKrw: match.totalCourtFeeKrw,
    additionalCostNote: match.additionalCostNote,
    introduction: match.introduction,
    partnerPreferenceLabel: partnerPreferenceLabels[match.partnerPreference],
    host: { nickname: match.host.nickname, tennisProfile: toProfileView(match.host.tennisProfile) },
    viewer: {
      relation,
      canApply,
      applyBlockedReason,
      applicationId: application?.id ?? null,
      canComplete: relation === "HOST" && match.status === "CLOSED" && match.endsAt <= now,
    },
    contact: canSeeContact
      ? { type: "KAKAO_OPEN_CHAT", url: match.contactOpenChatUrl, label: "카카오 오픈채팅으로 연락하기" }
      : null,
    version: match.version,
    createdAt: match.createdAt.toISOString(),
    acceptedCount,
  };
}

function optionalText(value: string | null | undefined) {
  return value?.trim() || null;
}

function isSameCreateRequest(match: MatchWithRelations, input: MatchCreateInput) {
  return match.title === input.title &&
    match.startsAt.getTime() === new Date(input.startsAt).getTime() &&
    match.endsAt.getTime() === new Date(input.endsAt).getTime() &&
    match.regionCode === input.regionCode &&
    match.courtSource === input.courtSource &&
    match.externalCourtName === input.externalCourt.name &&
    match.externalCourtAddress === input.externalCourt.address &&
    match.externalCourtNumber === optionalText(input.externalCourt.courtNumber) &&
    match.recruitCount === input.recruitCount &&
    match.partnerPreference === input.partnerPreference &&
    match.totalCourtFeeKrw === input.totalCourtFeeKrw &&
    match.additionalCostNote === optionalText(input.additionalCostNote) &&
    match.introduction === optionalText(input.introduction) &&
    match.contactOpenChatUrl === input.contactOpenChatUrl &&
    match.purposes.map(({ purpose }) => purpose).sort().join(",") === [...input.playPurposes].sort().join(",");
}

export async function createMatch(prisma: PrismaClient, viewer: Viewer, input: MatchCreateInput) {
  const region = await prisma.region.findFirst({ where: { code: input.regionCode, active: true, type: "DISTRICT" }, select: { code: true } });
  if (!region) throw new DomainError("INVALID_REGION", 422, "활성화된 시·군·구를 선택해 주세요.");

  const existing = await prisma.match.findUnique({
    where: { hostUserId_clientRequestId: { hostUserId: viewer.id, clientRequestId: input.clientRequestId } },
    include: matchInclude,
  });
  if (existing) {
    if (!isSameCreateRequest(existing, input)) throw new DomainError("IDEMPOTENCY_KEY_REUSED", 409, "같은 요청 식별자로 다른 매칭을 만들 수 없어요.");
    return { match: await getMatchDetail(prisma, viewer, existing.id), created: false };
  }

  const created = await prisma.match.create({
    data: {
      hostUserId: viewer.id, clientRequestId: input.clientRequestId, regionCode: input.regionCode, title: input.title,
      startsAt: new Date(input.startsAt), endsAt: new Date(input.endsAt), courtSource: "EXTERNAL_RESERVED",
      externalCourtName: input.externalCourt.name, externalCourtAddress: input.externalCourt.address,
      externalCourtNumber: optionalText(input.externalCourt.courtNumber), recruitCount: input.recruitCount,
      partnerPreference: input.partnerPreference, totalCourtFeeKrw: input.totalCourtFeeKrw,
      additionalCostNote: optionalText(input.additionalCostNote), introduction: optionalText(input.introduction),
      contactOpenChatUrl: input.contactOpenChatUrl, purposes: { create: input.playPurposes.map((purpose) => ({ purpose })) },
    },
    select: { id: true },
  });
  return { match: await getMatchDetail(prisma, viewer, created.id), created: true };
}

export async function getHostedMatches(prisma: PrismaClient, viewer: Viewer) {
  const matches = await prisma.match.findMany({
    where: { hostUserId: viewer.id }, orderBy: [{ startsAt: "asc" }, { id: "asc" }], include: matchInclude,
  });
  return matches.map((match) => toMatchCardView(match, viewer));
}
