import type { ApplicationStatus, GameExperience, MatchStatus, PlayPurpose, RallyLevel } from "@/generated/prisma/client";
import { z } from "zod";

import { gameLabels, purposeLabels, rallyLabels } from "./profile";

export type MatchRecommendationReasonCode =
  | "SAME_RALLY_LEVEL"
  | "NEAR_RALLY_LEVEL"
  | "SAME_PLAY_PURPOSE"
  | "SIMILAR_GAME_EXPERIENCE"
  | "BEGINNER_WELCOME";

export type RecommendationReason = {
  code: MatchRecommendationReasonCode;
  label: string;
};

const playPurposeValues = ["CASUAL_HIT", "RALLY_PRACTICE", "STROKE_PRACTICE", "GAME_INTRO", "GAME"] as const;

const matchCreateCommonSchema = z.object({
  clientRequestId: z.string().uuid("요청 식별자를 다시 만들어 주세요."),
  title: z.string().trim().min(1, "매칭 제목을 입력해 주세요.").max(80, "제목은 80자 이하여야 해요."),
  recruitCount: z.number().int().min(1, "추가 모집 인원은 1명 이상이어야 해요."),
  playPurposes: z.array(z.enum(playPurposeValues)).min(1, "원하는 플레이를 선택해 주세요.").max(2).refine((items) => new Set(items).size === items.length, "같은 플레이를 중복 선택할 수 없어요."),
  partnerPreference: z.enum(["COMPLETE_BEGINNER_WELCOME", "SIMILAR_LEVEL", "GAME_CAPABLE"]),
  introduction: z.string().trim().max(300).nullable().optional(),
});

const directMatchTimingSchema = {
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
};

const externalReservedMatchSchema = matchCreateCommonSchema.extend({
  ...directMatchTimingSchema,
  courtSource: z.literal("EXTERNAL_RESERVED"),
  externalCourt: z.object({
    name: z.string().trim().min(1, "코트장 이름을 입력해 주세요.").max(100),
    address: z.string().trim().min(1, "코트 주소를 입력해 주세요.").max(255),
    courtNumber: z.string().trim().max(50).nullable().optional(),
    imageUploadId: z.string().uuid("코트 사진을 다시 올려 주세요.").nullable().optional(),
  }),
  totalCourtFeeKrw: z.number().int().min(0, "코트 비용은 0원 이상이어야 해요.").max(1_000_000, "코트 비용은 100만원 이하로 입력해 주세요."),
  additionalCostNote: z.string().trim().max(200).nullable().optional(),
});

const partnerCourtMatchSchema = matchCreateCommonSchema.extend({
  courtSource: z.literal("PARTNER_COURT"),
  courtSlotId: z.string().uuid("제휴 코트 시간대를 다시 선택해 주세요."),
}).strict();

export const matchCreateInputSchema = z.discriminatedUnion("courtSource", [externalReservedMatchSchema, partnerCourtMatchSchema]).superRefine((input, context) => {
  if (input.courtSource !== "PARTNER_COURT") {
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (startsAt <= new Date()) context.addIssue({ code: "custom", path: ["startsAt"], message: "시작 시간은 현재보다 미래여야 해요." });
    if (startsAt >= endsAt) context.addIssue({ code: "custom", path: ["endsAt"], message: "종료 시간은 시작 시간보다 늦어야 해요." });
  }
  if (input.courtSource === "EXTERNAL_RESERVED" && input.externalCourt.courtNumber && /(\d[ -]?){7,}/.test(input.externalCourt.courtNumber)) context.addIssue({ code: "custom", path: ["externalCourt", "courtNumber"], message: "예약번호나 연락처는 코트 번호에 입력하지 마세요." });
});

export type MatchCreateInput = z.infer<typeof matchCreateInputSchema>;

export const matchApplicationInputSchema = z.object({
  message: z.string().trim().max(200, "한마디는 200자 이하여야 해요.").nullable().optional(),
});

export type MatchApplicationInput = z.infer<typeof matchApplicationInputSchema>;

export const matchApplicationDecisionInputSchema = z.object({
  expectedMatchVersion: z.number().int().positive("매칭 정보를 다시 불러와 주세요."),
});

export type MatchApplicationDecisionInput = z.infer<typeof matchApplicationDecisionInputSchema>;

export const matchLifecycleInputSchema = z.object({
  expectedVersion: z.number().int().positive("매칭 정보를 다시 불러와 주세요."),
});

export type MatchLifecycleInput = z.infer<typeof matchLifecycleInputSchema>;

export const matchCancelInputSchema = matchLifecycleInputSchema.extend({
  reason: z.string().trim().max(200, "취소 안내는 200자 이하여야 해요.").nullable().optional(),
});

export type MatchCancelInput = z.infer<typeof matchCancelInputSchema>;

export type RecommendationProfile = {
  rallyLevel: RallyLevel;
  gameExperience: GameExperience;
  playPurposes: readonly PlayPurpose[];
};

export type RecommendationMatch = {
  partnerPreference: "COMPLETE_BEGINNER_WELCOME" | "SIMILAR_LEVEL" | "GAME_CAPABLE";
  playPurposes: readonly PlayPurpose[];
};

const rallyRanks: Record<RallyLevel, number> = {
  STARTING: 1,
  SHORT_RALLY: 2,
  COMFORTABLE_RALLY: 3,
  STANDARD_RALLY: 4,
};

const gameRanks: Record<GameExperience, number> = {
  NONE: 1,
  KNOWS_RULES: 2,
  PLAYED_FEW: 3,
  CAN_PLAY: 4,
};

export const matchStatusLabels: Record<MatchStatus, string> = {
  OPEN: "모집 중",
  CLOSED: "모집 마감",
  COMPLETED: "완료",
  EXPIRED: "성사 없이 종료",
  CANCELLED: "취소됨",
};

export const applicationStatusLabels: Record<ApplicationStatus, string> = {
  PENDING: "검토 중",
  ACCEPTED: "같이 치게 됐어요",
  REJECTED: "이번에는 함께하기 어려워요",
  WITHDRAWN: "신청 철회",
  CANCELLED: "모집이 마감됐어요",
};

export function getApplicationStatusLabel(status: ApplicationStatus, matchStatus: MatchStatus) {
  if (status !== "CANCELLED") return applicationStatusLabels[status];
  if (matchStatus === "CLOSED") return "모집이 마감됐어요";
  if (matchStatus === "CANCELLED") return "매칭이 취소됐어요";
  if (matchStatus === "EXPIRED") return "성사 없이 종료됐어요";
  return "신청이 취소됐어요";
}

export const partnerPreferenceLabels = {
  COMPLETE_BEGINNER_WELCOME: "완전 초보도 좋아요",
  SIMILAR_LEVEL: "비슷한 수준이면 좋아요",
  GAME_CAPABLE: "게임 가능한 분을 찾고 있어요",
} as const;

export function getRecommendation(
  viewer: RecommendationProfile,
  host: RecommendationProfile | null,
  match: RecommendationMatch,
) {
  if (!host) return { score: 0, reasons: [] as RecommendationReason[] };

  const reasons: RecommendationReason[] = [];
  let score = 0;
  const rallyDistance = Math.abs(rallyRanks[viewer.rallyLevel] - rallyRanks[host.rallyLevel]);

  if (rallyDistance === 0) {
    score += 40;
    reasons.push({ code: "SAME_RALLY_LEVEL", label: "랠리 수준이 비슷해요." });
  } else if (rallyDistance === 1) {
    score += 25;
    reasons.push({ code: "NEAR_RALLY_LEVEL", label: "랠리 수준이 가까워요." });
  }

  const sharedPurpose = viewer.playPurposes.find((purpose) => match.playPurposes.includes(purpose));
  if (sharedPurpose) {
    score += 30;
    reasons.push({ code: "SAME_PLAY_PURPOSE", label: `둘 다 ${purposeLabels[sharedPurpose]}을 원해요.` });
  }

  if (Math.abs(gameRanks[viewer.gameExperience] - gameRanks[host.gameExperience]) <= 1) {
    score += 10;
    reasons.push({ code: "SIMILAR_GAME_EXPERIENCE", label: "게임 경험이 비슷해요." });
  }

  if (match.partnerPreference === "COMPLETE_BEGINNER_WELCOME") {
    reasons.push({ code: "BEGINNER_WELCOME", label: "초보자도 편하게 신청할 수 있어요." });
  }

  return { score, reasons };
}

export function getEstimatedFeePerPerson(totalCourtFeeKrw: number | null, recruitCount: number) {
  if (totalCourtFeeKrw === null) return null;
  return Math.ceil(totalCourtFeeKrw / (recruitCount + 1));
}

export function getAcceptedCount(applications: Array<{ status: ApplicationStatus }>) {
  return applications.filter((application) => application.status === "ACCEPTED").length;
}

export function getPendingCount(applications: Array<{ status: ApplicationStatus }>) {
  return applications.filter((application) => application.status === "PENDING").length;
}

export function hasRemainingSpots(recruitCount: number, applications: Array<{ status: ApplicationStatus }>) {
  return getAcceptedCount(applications) < recruitCount;
}

export function isDiscoverableMatch({
  status,
  startsAt,
  recruitCount,
  applications,
  now,
}: {
  status: MatchStatus;
  startsAt: Date;
  recruitCount: number;
  applications: Array<{ status: ApplicationStatus }>;
  now: Date;
}) {
  return status === "OPEN" && startsAt > now && hasRemainingSpots(recruitCount, applications);
}

export function getProfileLabels(profile: Pick<RecommendationProfile, "rallyLevel" | "gameExperience">) {
  return {
    rallyLevelLabel: rallyLabels[profile.rallyLevel],
    gameExperienceLabel: gameLabels[profile.gameExperience],
  };
}
