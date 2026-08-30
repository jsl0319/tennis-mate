import { describe, expect, it } from "vitest";

import { getApplicationStatusLabel, getEstimatedFeePerPerson, getPendingCount, getRecommendation, isDiscoverableMatch, matchApplicationDecisionInputSchema, matchApplicationInputSchema, matchCancelInputSchema, matchCreateInputSchema, matchLifecycleInputSchema } from "./match";

const viewer = {
  rallyLevel: "SHORT_RALLY" as const,
  gameExperience: "NONE" as const,
  activityRegionCode: "SEOUL-001",
  playPurposes: ["RALLY_PRACTICE"] as const,
};

describe("M3 match discovery rules", () => {
  it("scores same rally, purpose, region, and game experience without exposing the score", () => {
    const recommendation = getRecommendation(viewer, viewer, {
      partnerPreference: "COMPLETE_BEGINNER_WELCOME",
      playPurposes: ["RALLY_PRACTICE"],
    });
    expect(recommendation.score).toBe(100);
    expect(recommendation.reasons.map((reason) => reason.code)).toEqual([
      "SAME_RALLY_LEVEL", "SAME_PLAY_PURPOSE", "SAME_REGION", "SIMILAR_GAME_EXPERIENCE", "BEGINNER_WELCOME",
    ]);
  });

  it("scores an adjacent rally level but not a two-step difference", () => {
    const adjacent = getRecommendation(viewer, { ...viewer, rallyLevel: "COMFORTABLE_RALLY" }, { partnerPreference: "SIMILAR_LEVEL", playPurposes: [] });
    const distant = getRecommendation(viewer, { ...viewer, rallyLevel: "STANDARD_RALLY" }, { partnerPreference: "SIMILAR_LEVEL", playPurposes: [] });
    expect(adjacent.score).toBe(55);
    expect(distant.score).toBe(30);
  });

  it("only exposes open, future matches with remaining spots", () => {
    const base = { status: "OPEN" as const, startsAt: new Date("2030-01-01T01:00:00.000Z"), recruitCount: 2, applications: [], now: new Date("2029-01-01T01:00:00.000Z") };
    expect(isDiscoverableMatch(base)).toBe(true);
    expect(isDiscoverableMatch({ ...base, applications: [{ status: "ACCEPTED" as const }, { status: "ACCEPTED" as const }] })).toBe(false);
    expect(isDiscoverableMatch({ ...base, status: "CLOSED" })).toBe(false);
    expect(isDiscoverableMatch({ ...base, startsAt: new Date("2028-01-01T01:00:00.000Z") })).toBe(false);
  });

  it("rounds the expected individual fee up to a won", () => {
    expect(getEstimatedFeePerPerson(40_000, 2)).toBe(13_334);
  });
});

describe("M4 match creation input", () => {
  const validInput = {
    clientRequestId: "e3e70682-c209-4cac-a29f-6fbed82c07cd", title: "천천히 랠리 연습해요",
    startsAt: "2030-01-02T01:00:00.000Z", endsAt: "2030-01-02T03:00:00.000Z", regionCode: "SEOUL-001",
    courtSource: "EXTERNAL_RESERVED", externalCourt: { name: "마포 테니스장", address: "서울 마포구" }, recruitCount: 2,
    playPurposes: ["RALLY_PRACTICE"], partnerPreference: "COMPLETE_BEGINNER_WELCOME", totalCourtFeeKrw: 40_000,
  } as const;

  it("accepts an external reserved court and a free court", () => {
    expect(matchCreateInputSchema.parse({ ...validInput, totalCourtFeeKrw: 0 }).courtSource).toBe("EXTERNAL_RESERVED");
  });

  it("rejects a new court-undecided match without court details or a fee", () => {
    expect(() => matchCreateInputSchema.parse({
      ...validInput,
      courtSource: "COURT_TBD",
      externalCourt: null,
      totalCourtFeeKrw: null,
      additionalCostNote: null,
    })).toThrow();
  });

  it("accepts a partner court match only with the selected public slot", () => {
    const partner = matchCreateInputSchema.parse({
      clientRequestId: "e3e70682-c209-4cac-a29f-6fbed82c07cf",
      courtSource: "PARTNER_COURT",
      courtSlotId: "e3e70682-c209-4cac-a29f-6fbed82c07ce",
      title: "제휴 코트에서 랠리해요",
      recruitCount: 2,
      playPurposes: ["RALLY_PRACTICE"],
      partnerPreference: "SIMILAR_LEVEL",
    });

    expect(partner.courtSource).toBe("PARTNER_COURT");
    expect(() => matchCreateInputSchema.parse({ ...partner, startsAt: validInput.startsAt })).toThrow();
    expect(() => matchCreateInputSchema.parse({ ...partner, totalCourtFeeKrw: 40_000 })).toThrow();
  });

  it("keeps the null fee calculation for historical court-undecided records", () => {
    expect(getEstimatedFeePerPerson(null, 2)).toBeNull();
  });

  it("rejects an invalid court source or time range while keeping contact in the Match chat", () => {
    expect(() => matchCreateInputSchema.parse({ ...validInput, courtSource: "PARTNER_COURT" })).toThrow();
    expect(() => matchCreateInputSchema.parse({ ...validInput, endsAt: validInput.startsAt })).toThrow("종료 시간");
    expect(matchCreateInputSchema.parse(validInput).courtSource).toBe("EXTERNAL_RESERVED");
  });
});

describe("M5 match application input", () => {
  it("trims the optional message and rejects messages over 200 characters", () => {
    expect(matchApplicationInputSchema.parse({ message: "  천천히 랠리하고 싶어요.  " }).message).toBe("천천히 랠리하고 싶어요.");
    expect(() => matchApplicationInputSchema.parse({ message: "가".repeat(201) })).toThrow("200자");
  });
});

describe("M6 application decisions", () => {
  it("requires a positive, current match version for acceptance", () => {
    expect(matchApplicationDecisionInputSchema.parse({ expectedMatchVersion: 3 })).toEqual({ expectedMatchVersion: 3 });
    expect(() => matchApplicationDecisionInputSchema.parse({ expectedMatchVersion: 0 })).toThrow();
  });

  it("counts only pending applications for the host review badge", () => {
    expect(getPendingCount([{ status: "PENDING" as const }, { status: "ACCEPTED" as const }, { status: "PENDING" as const }])).toBe(2);
  });
});

describe("M7 lifecycle inputs and user-facing state", () => {
  it("requires a current version for lifecycle changes and limits an optional cancellation note", () => {
    expect(matchLifecycleInputSchema.parse({ expectedVersion: 4 })).toEqual({ expectedVersion: 4 });
    expect(matchCancelInputSchema.parse({ expectedVersion: 4, reason: null })).toEqual({ expectedVersion: 4, reason: null });
    expect(() => matchLifecycleInputSchema.parse({ expectedVersion: 0 })).toThrow();
    expect(() => matchCancelInputSchema.parse({ expectedVersion: 4, reason: "가".repeat(201) })).toThrow("200자");
  });

  it("distinguishes cancelled applications by their match outcome", () => {
    expect(getApplicationStatusLabel("CANCELLED", "CLOSED")).toBe("모집이 마감됐어요");
    expect(getApplicationStatusLabel("CANCELLED", "CANCELLED")).toBe("매칭이 취소됐어요");
    expect(getApplicationStatusLabel("CANCELLED", "EXPIRED")).toBe("성사 없이 종료됐어요");
    expect(getApplicationStatusLabel("ACCEPTED", "CLOSED")).toBe("같이 치게 됐어요");
  });
});
