import { describe, expect, it } from "vitest";

import { getLoginPath, getOnboardingPath, getSafeReturnTo, getStartAuthCallbackPath, isOperatorApplicationReturnTo } from "./return-to";

describe("safe return paths", () => {
  it("keeps a local app path, including query and hash", () => {
    expect(getSafeReturnTo("/matches/abc?from=notification#apply")).toBe("/matches/abc?from=notification#apply");
  });

  it.each(["https://example.com", "//example.com", "/\\example.com", "/%2f%2fexample.com", "matches/new"]) ("rejects an unsafe return path: %s", (value) => {
    expect(getSafeReturnTo(value)).toBe("/");
  });

  it("uses the safe path when building login and onboarding redirects", () => {
    expect(getLoginPath("/activity/sent")).toBe("/login?returnTo=%2Factivity%2Fsent");
    expect(getOnboardingPath("/activity/sent")).toBe("/?returnTo=%2Factivity%2Fsent");
  });

  it("sends the two entry intents through the right common-auth callback", () => {
    expect(getStartAuthCallbackPath("PLAYER", "/matches/new")).toBe("/login?returnTo=%2Fmatches%2Fnew");
    expect(getStartAuthCallbackPath("OPERATOR", "/matches/new")).toBe("/partner/apply");
  });

  it("only skips player onboarding for the two protected operator-application paths", () => {
    expect(isOperatorApplicationReturnTo("/partner/apply?from=entry")).toBe(true);
    expect(isOperatorApplicationReturnTo("/partner/application")).toBe(true);
    expect(isOperatorApplicationReturnTo("/matches/new")).toBe(false);
    expect(isOperatorApplicationReturnTo("https://example.com/partner/apply")).toBe(false);
  });
});
