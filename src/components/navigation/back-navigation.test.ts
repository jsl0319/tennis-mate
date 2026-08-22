import { describe, expect, it, vi } from "vitest";

import { returnToPreviousScreen } from "./back-navigation";

describe("top back navigation", () => {
  it("returns to the immediately previous page when browser history exists", () => {
    const onBack = vi.fn();
    const onFallback = vi.fn();

    returnToPreviousScreen(2, onBack, onFallback);

    expect(onBack).toHaveBeenCalledOnce();
    expect(onFallback).not.toHaveBeenCalled();
  });

  it("returns home only when a directly opened page has no prior history", () => {
    const onBack = vi.fn();
    const onFallback = vi.fn();

    returnToPreviousScreen(1, onBack, onFallback);

    expect(onBack).not.toHaveBeenCalled();
    expect(onFallback).toHaveBeenCalledOnce();
  });
});
