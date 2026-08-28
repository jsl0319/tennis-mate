import { z } from "zod";

import { getRateLimitedCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { operatorApplicationReviewInputSchema } from "@/server/domain/operator-application";
import {
  reviewOperatorApplication,
  toOperatorApplicationView,
} from "@/server/domain/operator-application-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

const applicationIdSchema = z.string().uuid();

export async function POST(request: Request, context: { params: Promise<{ applicationId: string }> }) {
  try {
    const { applicationId } = await context.params;
    const reviewer = await getRateLimitedCurrentUser();
    const application = await reviewOperatorApplication(
      getPrisma(),
      reviewer,
      applicationIdSchema.parse(applicationId),
      operatorApplicationReviewInputSchema.parse(await request.json()),
    );
    return Response.json(toOperatorApplicationView(application));
  } catch (error) {
    return handleApiError(error);
  }
}
