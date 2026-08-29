import { getRateLimitedCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { matchChatMatchIdSchema, matchChatMessageIdSchema, matchChatReportInputSchema } from "@/server/domain/match-chat";
import { reportMatchChatMessage } from "@/server/domain/match-chat-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ matchId: string; messageId: string }> }) {
  try {
    const { matchId: rawMatchId, messageId: rawMessageId } = await context.params;
    const user = await getRateLimitedCurrentUser();
    const matchId = matchChatMatchIdSchema.parse(rawMatchId);
    const messageId = matchChatMessageIdSchema.parse(rawMessageId);
    return Response.json(await reportMatchChatMessage(getPrisma(), user.id, matchId, messageId, matchChatReportInputSchema.parse(await request.json())), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
