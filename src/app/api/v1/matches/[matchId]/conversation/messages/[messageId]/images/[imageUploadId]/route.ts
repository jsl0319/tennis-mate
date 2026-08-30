import { NextResponse } from "next/server";

import { getRateLimitedCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { getMatchChatImageObjectRefForMember, getPrivateMatchChatImage } from "@/server/domain/match-chat-image-service";
import { matchChatImageUploadIdSchema, matchChatMatchIdSchema, matchChatMessageIdSchema } from "@/server/domain/match-chat";
import { DomainError } from "@/server/domain/profile-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ matchId: string; messageId: string; imageUploadId: string }> }) {
  try {
    const { matchId: rawMatchId, messageId: rawMessageId, imageUploadId: rawImageUploadId } = await context.params;
    const user = await getRateLimitedCurrentUser();
    const matchId = matchChatMatchIdSchema.parse(rawMatchId);
    const messageId = matchChatMessageIdSchema.parse(rawMessageId);
    const imageUploadId = matchChatImageUploadIdSchema.parse(rawImageUploadId);
    const objectRef = await getMatchChatImageObjectRefForMember(getPrisma(), user.id, matchId, messageId, imageUploadId);
    const result = await getPrivateMatchChatImage(objectRef, request.headers.get("if-none-match"));
    if (!result) throw new DomainError("MATCH_CONVERSATION_NOT_FOUND", 404, "채팅방을 찾을 수 없어요.");

    const headers = new Headers({
      "Cache-Control": "private, max-age=300",
      "ETag": result.blob.etag,
      "X-Content-Type-Options": "nosniff",
    });
    if (result.statusCode === 304) return new NextResponse(null, { status: 304, headers });
    headers.set("Content-Type", result.blob.contentType);
    return new NextResponse(result.stream, { headers });
  } catch (error) {
    return handleApiError(error);
  }
}
