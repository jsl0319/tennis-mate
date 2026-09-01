import { afterEach, describe, expect, it, vi } from "vitest";

import { searchKakaoCourtPlaces } from "./kakao-place-search";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("searchKakaoCourtPlaces", () => {
  it("falls back safely when the server-only Kakao key is missing", async () => {
    vi.stubEnv("KAKAO_REST_API_KEY", "");
    vi.stubEnv("AUTH_KAKAO_ID", "");

    await expect(searchKakaoCourtPlaces("마포", vi.fn())).rejects.toMatchObject({
      code: "COURT_PLACE_SEARCH_UNAVAILABLE",
      status: 503,
    });
  });

  it("searches Kakao with a tennis venue query and returns only name and address fields", async () => {
    vi.stubEnv("KAKAO_REST_API_KEY", "server-only-key");
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      documents: [
        {
          id: "place-id",
          place_name: "마포 테니스장",
          address_name: "서울 마포구 성산동 1",
          road_address_name: "서울 마포구 월드컵로 1",
          phone: "02-000-0000",
          x: "126.1",
          y: "37.5",
        },
      ],
    })));

    await expect(searchKakaoCourtPlaces("마포", request)).resolves.toEqual([
      { name: "마포 테니스장", address: "서울 마포구 월드컵로 1", roadAddress: "서울 마포구 월드컵로 1" },
    ]);

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ href: expect.stringContaining("query=%EB%A7%88%ED%8F%AC+%ED%85%8C%EB%8B%88%EC%8A%A4%EC%9E%A5") }),
      expect.objectContaining({ headers: { Authorization: "KakaoAK server-only-key" }, cache: "no-store" }),
    );
  });

  it("uses the existing Kakao login REST key when a dedicated key is not set", async () => {
    vi.stubEnv("KAKAO_REST_API_KEY", "");
    vi.stubEnv("AUTH_KAKAO_ID", "login-rest-key");
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ documents: [] })));

    await expect(searchKakaoCourtPlaces("마포", request)).resolves.toEqual([]);

    expect(request).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ headers: { Authorization: "KakaoAK login-rest-key" } }),
    );
  });

  it("does not expose a provider response failure to the caller", async () => {
    vi.stubEnv("KAKAO_REST_API_KEY", "server-only-key");

    await expect(searchKakaoCourtPlaces("마포", vi.fn().mockResolvedValue(new Response("unauthorized", { status: 401 })))).rejects.toMatchObject({
      code: "COURT_PLACE_SEARCH_UNAVAILABLE",
      status: 503,
    });
  });
});
