import { NextResponse } from "next/server";

import { getPrisma } from "@/server/db/prisma";
import { cleanupPendingMatchChatImageUploads } from "@/server/domain/match-chat-image-service";

export const runtime = "nodejs";

function hasValidCronSecret(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  return Boolean(cronSecret) && request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!hasValidCronSecret(request)) return new NextResponse(null, { status: 401 });
  try {
    const result = await cleanupPendingMatchChatImageUploads(getPrisma());
    console.info({ event: "cron.cleanup_match_chat_image_uploads.completed", ...result });
    return NextResponse.json({ status: "ok", ...result });
  } catch (error) {
    console.error({ event: "cron.cleanup_match_chat_image_uploads.failed", name: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ status: "error", message: "미연결 채팅 사진 정리를 완료하지 못했어요." }, { status: 500 });
  }
}
