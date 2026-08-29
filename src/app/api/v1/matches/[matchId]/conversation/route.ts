import { getRateLimitedCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { matchChatMatchIdSchema } from "@/server/domain/match-chat";
import { getMatchConversation } from "@/server/domain/match-chat-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    const { matchId: rawMatchId } = await context.params;
    const user = await getRateLimitedCurrentUser();
    const matchId = matchChatMatchIdSchema.parse(rawMatchId);
    return Response.json(await getMatchConversation(getPrisma(), user.id, matchId));
  } catch (error) {
    return handleApiError(error);
  }
}
