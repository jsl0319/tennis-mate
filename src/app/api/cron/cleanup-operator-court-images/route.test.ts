import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cleanupOperatorCourtImages, getPrisma } = vi.hoisted(() => ({ cleanupOperatorCourtImages: vi.fn(), getPrisma: vi.fn() }));

vi.mock("@/server/db/prisma", () => ({ getPrisma }));
vi.mock("@/server/domain/operator-court-image-service", () => ({ cleanupOperatorCourtImages }));

import { GET } from "./route";

describe("operator court image cleanup cron endpoint", () => {
  beforeEach(() => {
    cleanupOperatorCourtImages.mockReset();
    getPrisma.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("requires the cron secret", async () => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
    await expect(GET(new Request("http://localhost/api/cron/cleanup-operator-court-images"))).resolves.toMatchObject({ status: 401 });
    expect(cleanupOperatorCourtImages).not.toHaveBeenCalled();
  });

  it("runs the scheduled cleanup after authorization", async () => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
    getPrisma.mockReturnValue({});
    cleanupOperatorCourtImages.mockResolvedValue({ checked: 2, deleted: 2, failed: 0 });
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const response = await GET(new Request("http://localhost/api/cron/cleanup-operator-court-images", { headers: { authorization: "Bearer test-cron-secret" } }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok", checked: 2, deleted: 2, failed: 0 });
    infoSpy.mockRestore();
  });
});
