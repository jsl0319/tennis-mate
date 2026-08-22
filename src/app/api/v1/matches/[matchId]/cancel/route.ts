import { getRateLimitedCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { matchCancelInputSchema } from "@/server/domain/match";
import { cancelMatch, getOnboardedViewer } from "@/server/domain/match-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    const { matchId } = await context.params;
    const user = await getRateLimitedCurrentUser();
    const prisma = getPrisma();
    return Response.json(await cancelMatch(prisma, await getOnboardedViewer(prisma, user), matchId, matchCancelInputSchema.parse(await request.json())));
  } catch (error) {
    return handleApiError(error);
  }
}
