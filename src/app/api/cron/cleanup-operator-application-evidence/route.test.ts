import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cleanupOperatorApplicationEvidenceUploads, getPrisma } = vi.hoisted(() => ({
  cleanupOperatorApplicationEvidenceUploads: vi.fn(),
  getPrisma: vi.fn(),
}));

vi.mock("@/server/db/prisma", () => ({ getPrisma }));
vi.mock("@/server/domain/operator-application-evidence-service", () => ({ cleanupOperatorApplicationEvidenceUploads }));

import { GET } from "./route";

describe("operator application evidence cleanup cron endpoint", () => {
  beforeEach(() => {
    cleanupOperatorApplicationEvidenceUploads.mockReset();
    getPrisma.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("rejects requests without the cron secret", async () => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret");

    await expect(GET(new Request("http://localhost/api/cron/cleanup-operator-application-evidence"))).resolves.toMatchObject({ status: 401 });
    expect(cleanupOperatorApplicationEvidenceUploads).not.toHaveBeenCalled();
  });

  it("runs only after Vercel cron authorization", async () => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
    getPrisma.mockReturnValue({});
    cleanupOperatorApplicationEvidenceUploads.mockResolvedValue({ checked: 3, deleted: 2, failed: 1 });
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const response = await GET(new Request("http://localhost/api/cron/cleanup-operator-application-evidence", { headers: { authorization: "Bearer test-cron-secret" } }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok", checked: 3, deleted: 2, failed: 1 });
    expect(cleanupOperatorApplicationEvidenceUploads).toHaveBeenCalledWith({});
    infoSpy.mockRestore();
  });
});
