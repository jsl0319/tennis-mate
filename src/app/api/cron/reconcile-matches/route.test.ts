import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getPrisma, reconcileStartedMatches } = vi.hoisted(() => ({
  getPrisma: vi.fn(),
  reconcileStartedMatches: vi.fn(),
}));

vi.mock("@/server/db/prisma", () => ({ getPrisma }));
vi.mock("@/server/domain/match-service", () => ({ reconcileStartedMatches }));

import { GET } from "./route";

describe("match lifecycle cron endpoint", () => {
  beforeEach(() => {
    getPrisma.mockReset();
    reconcileStartedMatches.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("rejects a request without the cron secret", async () => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret");

    const response = await GET(new Request("http://localhost/api/cron/reconcile-matches"));

    expect(response.status).toBe(401);
    expect(getPrisma).not.toHaveBeenCalled();
    expect(reconcileStartedMatches).not.toHaveBeenCalled();
  });

  it("reconciles started matches when the cron secret is valid", async () => {
    const prisma = { match: {} };
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
    getPrisma.mockReturnValue(prisma);
    reconcileStartedMatches.mockResolvedValue({ checked: 3, closed: 1, expired: 2 });
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const response = await GET(new Request("http://localhost/api/cron/reconcile-matches", {
      headers: { authorization: "Bearer test-cron-secret" },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok", checked: 3, closed: 1, expired: 2 });
    expect(reconcileStartedMatches).toHaveBeenCalledWith(prisma);
    infoSpy.mockRestore();
  });

  it("does not expose a lifecycle failure", async () => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
    getPrisma.mockReturnValue({ match: {} });
    reconcileStartedMatches.mockRejectedValue(new Error("database password is unavailable"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await GET(new Request("http://localhost/api/cron/reconcile-matches", {
      headers: { authorization: "Bearer test-cron-secret" },
    }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ status: "error", message: "상태 보정 작업을 완료하지 못했어요." });
    errorSpy.mockRestore();
  });
});
