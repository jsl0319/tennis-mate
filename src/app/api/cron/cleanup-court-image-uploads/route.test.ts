import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cleanupPendingCourtImageUploads, getPrisma } = vi.hoisted(() => ({
  cleanupPendingCourtImageUploads: vi.fn(),
  getPrisma: vi.fn(),
}));

vi.mock("@/server/db/prisma", () => ({ getPrisma }));
vi.mock("@/server/domain/court-image-service", () => ({ cleanupPendingCourtImageUploads }));

import { GET } from "./route";

describe("court image cleanup cron endpoint", () => {
  beforeEach(() => {
    cleanupPendingCourtImageUploads.mockReset();
    getPrisma.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("rejects requests without the cron secret", async () => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret");

    await expect(GET(new Request("http://localhost/api/cron/cleanup-court-image-uploads"))).resolves.toMatchObject({ status: 401 });
    expect(cleanupPendingCourtImageUploads).not.toHaveBeenCalled();
  });

  it("runs cleanup only after Vercel cron authorization", async () => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
    getPrisma.mockReturnValue({});
    cleanupPendingCourtImageUploads.mockResolvedValue({ checked: 3, deleted: 2, failed: 1 });
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const response = await GET(new Request("http://localhost/api/cron/cleanup-court-image-uploads", { headers: { authorization: "Bearer test-cron-secret" } }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok", checked: 3, deleted: 2, failed: 1 });
    expect(cleanupPendingCourtImageUploads).toHaveBeenCalledWith({});
    infoSpy.mockRestore();
  });
});
