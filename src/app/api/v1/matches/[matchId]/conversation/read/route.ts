import { getRateLimitedCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { matchChatMatchIdSchema, matchChatReadInputSchema } from "@/server/domain/match-chat";
import { markMatchConversationRead } from "@/server/domain/match-chat-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    const { matchId: rawMatchId } = await context.params;
    const user = await getRateLimitedCurrentUser();
    const matchId = matchChatMatchIdSchema.parse(rawMatchId);
    return Response.json(await markMatchConversationRead(getPrisma(), user.id, matchId, matchChatReadInputSchema.parse(await request.json())));
  } catch (error) {
    return handleApiError(error);
  }
}
