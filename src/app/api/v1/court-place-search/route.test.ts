import { beforeEach, describe, expect, it, vi } from "vitest";

import { DomainError } from "@/server/domain/profile-service";

const { getOnboardedViewer, getPrisma, getRateLimitedCurrentUser, searchKakaoCourtPlaces } = vi.hoisted(() => ({
  getOnboardedViewer: vi.fn(),
  getPrisma: vi.fn(),
  getRateLimitedCurrentUser: vi.fn(),
  searchKakaoCourtPlaces: vi.fn(),
}));

vi.mock("@/server/auth/current-user", () => ({
  getRateLimitedCurrentUser,
  AuthenticationError: class AuthenticationError extends Error {},
  AccountAccessError: class AccountAccessError extends Error {},
}));
vi.mock("@/server/db/prisma", () => ({ getPrisma }));
vi.mock("@/server/domain/match-service", () => ({ getOnboardedViewer }));
vi.mock("@/server/integrations/kakao-place-search", () => ({ searchKakaoCourtPlaces }));

import { GET } from "./route";

describe("GET /api/v1/court-place-search", () => {
  beforeEach(() => {
    getOnboardedViewer.mockReset();
    getPrisma.mockReset();
    getRateLimitedCurrentUser.mockReset();
    searchKakaoCourtPlaces.mockReset();
    getRateLimitedCurrentUser.mockResolvedValue({ id: "member-id" });
    getPrisma.mockReturnValue({});
    getOnboardedViewer.mockResolvedValue({ id: "member-id" });
  });

  it("returns limited provider fields for an onboarded member and prevents caching", async () => {
    searchKakaoCourtPlaces.mockResolvedValue([
      { name: "마포 테니스장", address: "서울 마포구 월드컵로 1", roadAddress: "서울 마포구 월드컵로 1" },
    ]);

    const response = await GET(new Request("http://localhost/api/v1/court-place-search?q=%20%EB%A7%88%ED%8F%AC%20"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      items: [{ name: "마포 테니스장", address: "서울 마포구 월드컵로 1", roadAddress: "서울 마포구 월드컵로 1" }],
    });
    expect(getOnboardedViewer).toHaveBeenCalledWith({}, { id: "member-id" });
    expect(searchKakaoCourtPlaces).toHaveBeenCalledWith("마포");
  });

  it("rejects a one-character query before calling the external provider", async () => {
    const response = await GET(new Request("http://localhost/api/v1/court-place-search?q=%EA%B0%80"));

    expect(response.status).toBe(422);
    expect(searchKakaoCourtPlaces).not.toHaveBeenCalled();
  });

  it("does not call the external provider before the member finishes onboarding", async () => {
    getOnboardedViewer.mockRejectedValue(new DomainError("ONBOARDING_REQUIRED", 403, "테니스 정보를 먼저 알려 주세요."));

    const response = await GET(new Request("http://localhost/api/v1/court-place-search?q=%EB%A7%88%ED%8F%AC"));

    expect(response.status).toBe(403);
    expect(searchKakaoCourtPlaces).not.toHaveBeenCalled();
  });

  it("keeps direct input available when the provider is not configured", async () => {
    searchKakaoCourtPlaces.mockRejectedValue(new DomainError("COURT_PLACE_SEARCH_UNAVAILABLE", 503, "코트 검색을 준비 중이에요. 코트 이름과 주소를 직접 입력해 주세요."));

    const response = await GET(new Request("http://localhost/api/v1/court-place-search?q=%EB%A7%88%ED%8F%AC"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "COURT_PLACE_SEARCH_UNAVAILABLE" } });
  });
});
