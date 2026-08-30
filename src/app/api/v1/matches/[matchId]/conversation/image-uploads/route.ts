import { getRateLimitedCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { createMatchChatImageUpload } from "@/server/domain/match-chat-image-service";
import { matchChatMatchIdSchema } from "@/server/domain/match-chat";
import { DomainError } from "@/server/domain/profile-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    const { matchId: rawMatchId } = await context.params;
    const user = await getRateLimitedCurrentUser();
    const matchId = matchChatMatchIdSchema.parse(rawMatchId);
    const formData = await request.formData();
    const files = formData.getAll("file");
    const file = files[0];
    if (files.length !== 1 || !(file instanceof File)) {
      throw new DomainError("CHAT_IMAGE_FILE_REQUIRED", 422, "채팅 사진 파일을 선택해 주세요.");
    }
    if ([...formData.keys()].some((key) => key !== "file")) {
      throw new DomainError("INVALID_REQUEST", 400, "채팅 사진 파일만 올려 주세요.");
    }
    const upload = await createMatchChatImageUpload(getPrisma(), user.id, matchId, file);
    return Response.json(upload, { status: 201, headers: { Location: `/api/v1/matches/${matchId}/conversation/image-uploads/${upload.id}` } });
  } catch (error) {
    return handleApiError(error);
  }
}
