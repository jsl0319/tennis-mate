import { z } from "zod";

import { getRateLimitedCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { getOnboardedViewer } from "@/server/domain/match-service";
import { searchKakaoCourtPlaces } from "@/server/integrations/kakao-place-search";
import { handleApiError } from "@/server/http/api-response";

const searchQuerySchema = z.string().trim().min(2, "테니스장 이름을 두 글자 이상 입력해 주세요.").max(80, "테니스장 검색어는 80자 이하여야 해요.");

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await getRateLimitedCurrentUser();
    const prisma = getPrisma();
    await getOnboardedViewer(prisma, user);
    const query = searchQuerySchema.parse(new URL(request.url).searchParams.get("q") ?? "");
    const items = await searchKakaoCourtPlaces(query);

    return Response.json({ items }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return handleApiError(error);
  }
}
