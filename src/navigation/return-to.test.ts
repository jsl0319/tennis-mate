import { describe, expect, it } from "vitest";

import { getLoginPath, getOnboardingPath, getSafeReturnTo } from "./return-to";

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
});
