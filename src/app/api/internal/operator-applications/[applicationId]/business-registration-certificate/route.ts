import { NextResponse } from "next/server";

import { getRateLimitedCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import {
  getBusinessRegistrationCertificateObjectRefForReviewer,
  getPrivateOperatorApplicationEvidence,
} from "@/server/domain/operator-application-evidence-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ applicationId: string }> }) {
  try {
    const { applicationId } = await context.params;
    const reviewer = await getRateLimitedCurrentUser();
    const objectRef = await getBusinessRegistrationCertificateObjectRefForReviewer(getPrisma(), reviewer, applicationId);
    const result = await getPrivateOperatorApplicationEvidence(objectRef, request.headers.get("if-none-match"));
    if (!result) return new NextResponse(null, { status: 404 });

    const headers = new Headers({
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline; filename=business-registration-certificate",
      "Content-Security-Policy": "sandbox",
      "ETag": result.blob.etag,
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    });
    if (result.statusCode === 304) return new NextResponse(null, { status: 304, headers });

    headers.set("Content-Type", result.blob.contentType);
    return new NextResponse(result.stream, { headers });
  } catch (error) {
    return handleApiError(error);
  }
}
