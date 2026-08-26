import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CourtRallyLoader } from "./court-rally-loader";

describe("CourtRallyLoader", () => {
  it("announces the contextual loading message and keeps a reduced-motion fallback", () => {
    const markup = renderToStaticMarkup(createElement(CourtRallyLoader, { label: "매칭을 준비하고 있어요." }));

    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("매칭을 준비하고 있어요.");
    expect(markup).toContain("motion-reduce:animate-none");
  });
});
