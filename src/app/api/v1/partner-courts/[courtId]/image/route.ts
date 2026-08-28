import { NextResponse } from "next/server";

import { getCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { courtIdSchema } from "@/server/domain/court-slot";
import { getOnboardedViewer } from "@/server/domain/match-service";
import { getPrivateOperatorCourtImage, getPublicCourtImageObjectRef } from "@/server/domain/operator-court-image-service";
import { DomainError } from "@/server/domain/profile-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ courtId: string }> }) {
  try {
    const { courtId } = await context.params;
    const prisma = getPrisma();
    await getOnboardedViewer(prisma, await getCurrentUser());
    const objectRef = await getPublicCourtImageObjectRef(prisma, courtIdSchema.parse(courtId));
    const result = await getPrivateOperatorCourtImage(objectRef, request.headers.get("if-none-match"));
    if (!result) throw new DomainError("PARTNER_COURT_NOT_FOUND", 404, "코트를 찾을 수 없어요.");

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
