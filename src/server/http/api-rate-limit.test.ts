import { describe, expect, it } from "vitest";

import { API_RATE_LIMIT_WINDOW_MS, getApiRateLimitRetryAfterSeconds, getApiRateLimitWindowStartedAt } from "./api-rate-limit";

describe("API request rate-limit window", () => {
  it("groups requests into one-minute windows", () => {
    expect(getApiRateLimitWindowStartedAt(new Date("2026-08-23T00:01:45.000Z")).toISOString()).toBe("2026-08-23T00:01:00.000Z");
    expect(API_RATE_LIMIT_WINDOW_MS).toBe(60_000);
  });

  it("returns at least one second until the next window", () => {
    const now = new Date("2026-08-23T00:01:59.250Z");
    const windowStartedAt = getApiRateLimitWindowStartedAt(now);

    expect(getApiRateLimitRetryAfterSeconds(now, windowStartedAt)).toBe(1);
  });
});
