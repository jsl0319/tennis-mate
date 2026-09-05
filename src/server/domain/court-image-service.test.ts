import { describe, expect, it, vi } from "vitest";

import { getCourtImageObjectRefForViewer } from "./court-image-service";

describe("court image service", () => {
  it("does not reveal a closed match photo to someone outside its history", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      hostUserId: "host-id",
      status: "CLOSED",
      applications: [],
      externalCourtImageUpload: { privateObjectRef: "https://blob.example/private/court.jpg", status: "ATTACHED" },
    });

    await expect(getCourtImageObjectRefForViewer({ match: { findUnique } } as never, { id: "other-user-id" }, "match-id")).rejects.toMatchObject({
      code: "MATCH_NOT_FOUND",
      status: 404,
    });
  });
});
