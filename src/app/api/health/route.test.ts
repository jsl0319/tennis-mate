import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPrisma } = vi.hoisted(() => ({ getPrisma: vi.fn() }));

vi.mock("@/server/db/prisma", () => ({ getPrisma }));

import { GET } from "./route";

describe("health endpoint", () => {
  beforeEach(() => {
    getPrisma.mockReset();
  });

  it("does not expose database error details", async () => {
    getPrisma.mockReturnValue({
      $queryRaw: vi.fn().mockRejectedValue(new Error("postgres://secret-host:5432/database is unavailable")),
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: "degraded",
      database: "disconnected",
      message: "서비스 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.",
    });
    errorSpy.mockRestore();
  });
});
