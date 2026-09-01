import { z } from "zod";

import { DomainError } from "@/server/domain/profile-service";

const kakaoKeywordResponseSchema = z.object({
  documents: z.array(z.object({
    place_name: z.string().trim().min(1),
    address_name: z.string(),
    road_address_name: z.string(),
  })),
});

export type CourtPlaceSearchItem = {
  name: string;
  address: string;
  roadAddress: string | null;
};

function unavailablePlaceSearch() {
  return new DomainError("COURT_PLACE_SEARCH_UNAVAILABLE", 503, "코트 검색을 준비 중이에요. 코트 이름과 주소를 직접 입력해 주세요.");
}

export async function searchKakaoCourtPlaces(query: string, request = fetch): Promise<CourtPlaceSearchItem[]> {
  const apiKey = process.env.KAKAO_REST_API_KEY?.trim() || process.env.AUTH_KAKAO_ID?.trim();
  if (!apiKey) throw unavailablePlaceSearch();

  const searchQuery = query.includes("테니스") ? query : `${query} 테니스장`;
  const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
  url.searchParams.set("query", searchQuery);
  url.searchParams.set("size", "5");

  let response: Response;
  try {
    response = await request(url, {
      headers: { Authorization: `KakaoAK ${apiKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    throw unavailablePlaceSearch();
  }

  if (!response.ok) throw unavailablePlaceSearch();

  const body = kakaoKeywordResponseSchema.safeParse(await response.json());
  if (!body.success) throw unavailablePlaceSearch();

  return body.data.documents.flatMap((place) => {
    const address = place.road_address_name.trim() || place.address_name.trim();
    if (!address) return [];

    return [{
      name: place.place_name,
      address,
      roadAddress: place.road_address_name.trim() || null,
    }];
  });
}
