import { NextResponse } from "next/server";

import { getCurrentUser, getRateLimitedCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { courtIdSchema, courtImageIdSchema } from "@/server/domain/court-slot";
import {
  getOperatorCourtImageObjectRef,
  getPrivateOperatorCourtImage,
  removeOperatorCourtImage,
} from "@/server/domain/operator-court-image-service";
import { DomainError } from "@/server/domain/profile-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ courtId: string; imageId: string }> }) {
  try {
    const { courtId, imageId } = await context.params;
    const prisma = getPrisma();
    const objectRef = await getOperatorCourtImageObjectRef(
      prisma,
      await getCurrentUser(),
      courtIdSchema.parse(courtId),
      courtImageIdSchema.parse(imageId),
    );
    const result = await getPrivateOperatorCourtImage(objectRef, request.headers.get("if-none-match"));
    if (!result) throw new DomainError("OPERATOR_COURT_IMAGE_NOT_FOUND", 404, "코트 사진을 찾을 수 없어요.");

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

export async function DELETE(_request: Request, context: { params: Promise<{ courtId: string; imageId: string }> }) {
  try {
    const { courtId, imageId } = await context.params;
    await removeOperatorCourtImage(
      getPrisma(),
      await getRateLimitedCurrentUser(),
      courtIdSchema.parse(courtId),
      courtImageIdSchema.parse(imageId),
    );
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
