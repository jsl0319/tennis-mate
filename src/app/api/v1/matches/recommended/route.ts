import { getCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { getOnboardedViewer, getRecommendedMatches } from "@/server/domain/match-service";
import { DomainError } from "@/server/domain/profile-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const limitValue = new URL(request.url).searchParams.get("limit") ?? "5";
    const limit = Number(limitValue);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      throw new DomainError("INVALID_REQUEST", 400, "추천 개수는 1~50개로 입력해 주세요.");
    }

    const user = await getCurrentUser();
    const viewer = await getOnboardedViewer(getPrisma(), user);
    return Response.json({ items: await getRecommendedMatches(getPrisma(), viewer, limit) });
  } catch (error) {
    return handleApiError(error);
  }
}
