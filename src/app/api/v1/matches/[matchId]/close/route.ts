import { getCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { matchLifecycleInputSchema } from "@/server/domain/match";
import { closeMatch, getOnboardedViewer } from "@/server/domain/match-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    const { matchId } = await context.params;
    const user = await getCurrentUser();
    const prisma = getPrisma();
    return Response.json(await closeMatch(prisma, await getOnboardedViewer(prisma, user), matchId, matchLifecycleInputSchema.parse(await request.json())));
  } catch (error) {
    return handleApiError(error);
  }
}
