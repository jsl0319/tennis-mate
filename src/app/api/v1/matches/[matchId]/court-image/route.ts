import { NextResponse } from "next/server";

import { getCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { getCourtImageObjectRefForViewer, getPrivateCourtImage } from "@/server/domain/court-image-service";
import { getOnboardedViewer } from "@/server/domain/match-service";
import { DomainError } from "@/server/domain/profile-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    const { matchId } = await context.params;
    const prisma = getPrisma();
    const viewer = await getOnboardedViewer(prisma, await getCurrentUser());
    const objectRef = await getCourtImageObjectRefForViewer(prisma, viewer, matchId);
    const result = await getPrivateCourtImage(objectRef, request.headers.get("if-none-match"));
    if (!result) throw new DomainError("MATCH_NOT_FOUND", 404, "매칭을 찾을 수 없어요.");

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
