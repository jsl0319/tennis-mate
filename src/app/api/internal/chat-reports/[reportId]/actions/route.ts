import { getRateLimitedCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { matchChatModerationActionInputSchema } from "@/server/domain/match-chat";
import { moderateMatchChatReport } from "@/server/domain/match-chat-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ reportId: string }> }) {
  try {
    const { reportId } = await context.params;
    const reviewer = await getRateLimitedCurrentUser();
    return Response.json(await moderateMatchChatReport(getPrisma(), reviewer, reportId, matchChatModerationActionInputSchema.parse(await request.json())));
  } catch (error) {
    return handleApiError(error);
  }
}
