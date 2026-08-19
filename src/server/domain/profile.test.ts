import { describe, expect, it } from "vitest";

import { nicknameSchema, profileInputSchema } from "./profile";

const validProfile = {
  experienceRange: "YEARS_1_TO_2",
  rallyLevel: "SHORT_RALLY",
  gameExperience: "NONE",
  playPurposes: ["CASUAL_HIT"],
  activityRegionCode: "SEOUL-014",
  nearbyRegionAllowed: true,
  expectedVersion: null,
} as const;

describe("M2 profile input", () => {
  it("accepts the M2 region and experience contract", () => {
    expect(profileInputSchema.parse(validProfile)).toMatchObject(validProfile);
  });

  it("rejects more than two play purposes", () => {
    expect(() => profileInputSchema.parse({
      ...validProfile,
      playPurposes: ["CASUAL_HIT", "RALLY_PRACTICE", "GAME"],
    })).toThrow("최대 2개");
  });

  it("accepts 2–12 Korean, English, or numeric nickname characters only", () => {
    expect(nicknameSchema.parse("랠리Mate12")).toBe("랠리Mate12");
    expect(() => nicknameSchema.parse("테니스 메이트")).toThrow("한글, 영문, 숫자");
    expect(() => nicknameSchema.parse("tennismate123")).toThrow("12자");
  });
});
