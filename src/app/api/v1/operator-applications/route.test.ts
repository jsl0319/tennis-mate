import { beforeEach, describe, expect, it, vi } from "vitest";

const { getRateLimitedCurrentUser, getPrisma, submitOperatorApplication, toOperatorApplicationView } = vi.hoisted(() => ({
  getRateLimitedCurrentUser: vi.fn(),
  getPrisma: vi.fn(),
  submitOperatorApplication: vi.fn(),
  toOperatorApplicationView: vi.fn(),
}));

vi.mock("@/server/auth/current-user", () => ({
  getRateLimitedCurrentUser,
  AuthenticationError: class AuthenticationError extends Error {},
  AccountAccessError: class AccountAccessError extends Error {},
}));
vi.mock("@/server/db/prisma", () => ({ getPrisma }));
vi.mock("@/server/domain/operator-application-service", () => ({ submitOperatorApplication, toOperatorApplicationView }));

import { POST } from "./route";

const validBody = {
  businessName: "마포 테니스파크",
  businessRegistrationNumber: "123-45-67890",
  businessOpenedOn: "2024-01-02",
  representativeName: "홍길동",
  venueName: "마포 테니스파크",
  venueAddress: "서울특별시 마포구 월드컵로 00",
  operatorPhone: "010-1234-5678",
};

describe("POST /api/v1/operator-applications", () => {
  beforeEach(() => {
    getRateLimitedCurrentUser.mockReset(); getPrisma.mockReset(); submitOperatorApplication.mockReset(); toOperatorApplicationView.mockReset();
  });

  it("validates sensitive registration fields before calling the domain service", async () => {
    getRateLimitedCurrentUser.mockResolvedValue({ id: "user-id" });
    const response = await POST(new Request("http://localhost/api/v1/operator-applications", { method: "POST", body: JSON.stringify({ ...validBody, businessRegistrationNumber: "1234" }) }));

    expect(response.status).toBe(422);
    expect(submitOperatorApplication).not.toHaveBeenCalled();
  });

  it("uses the authenticated user rather than a client supplied owner id", async () => {
    const prisma = { courtOperatorApplication: {} };
    getRateLimitedCurrentUser.mockResolvedValue({ id: "session-user-id" });
    getPrisma.mockReturnValue(prisma);
    submitOperatorApplication.mockResolvedValue({ id: "application-id" });
    toOperatorApplicationView.mockReturnValue({ id: "application-id", status: "REVIEW_REQUIRED" });

    const response = await POST(new Request("http://localhost/api/v1/operator-applications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...validBody, applicantUserId: "attacker-id" }) }));

    expect(response.status).toBe(201);
    expect(submitOperatorApplication).toHaveBeenCalledWith(prisma, { id: "session-user-id" }, expect.objectContaining({ businessRegistrationNumber: "1234567890" }));
    await expect(response.json()).resolves.toEqual({ id: "application-id", status: "REVIEW_REQUIRED" });
  });
});
