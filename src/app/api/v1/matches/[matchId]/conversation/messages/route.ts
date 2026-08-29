import { getRateLimitedCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { matchChatMatchIdSchema, matchChatMessageInputSchema } from "@/server/domain/match-chat";
import { getMatchConversationMessages, sendMatchChatMessage } from "@/server/domain/match-chat-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    const { matchId: rawMatchId } = await context.params;
    const user = await getRateLimitedCurrentUser();
    const matchId = matchChatMatchIdSchema.parse(rawMatchId);
    const params = new URL(request.url).searchParams;
    return Response.json(await getMatchConversationMessages(getPrisma(), user.id, matchId, { before: params.get("before") ?? undefined, after: params.get("after") ?? undefined }));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    const { matchId: rawMatchId } = await context.params;
    const user = await getRateLimitedCurrentUser();
    const matchId = matchChatMatchIdSchema.parse(rawMatchId);
    const result = await sendMatchChatMessage(getPrisma(), user.id, matchId, matchChatMessageInputSchema.parse(await request.json()));
    return Response.json(result.message, { status: result.created ? 201 : 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
