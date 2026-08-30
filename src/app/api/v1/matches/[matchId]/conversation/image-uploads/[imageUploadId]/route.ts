import { getRateLimitedCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { discardMatchChatImageUpload } from "@/server/domain/match-chat-image-service";
import { matchChatImageUploadIdSchema, matchChatMatchIdSchema } from "@/server/domain/match-chat";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function DELETE(_request: Request, context: { params: Promise<{ matchId: string; imageUploadId: string }> }) {
  try {
    const { matchId: rawMatchId, imageUploadId: rawImageUploadId } = await context.params;
    const user = await getRateLimitedCurrentUser();
    const matchId = matchChatMatchIdSchema.parse(rawMatchId);
    const imageUploadId = matchChatImageUploadIdSchema.parse(rawImageUploadId);
    await discardMatchChatImageUpload(getPrisma(), user.id, matchId, imageUploadId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
