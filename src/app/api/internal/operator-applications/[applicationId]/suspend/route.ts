import { z } from "zod";

import { getRateLimitedCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { operatorApplicationSuspendInputSchema } from "@/server/domain/operator-application";
import { suspendOperatorApplication } from "@/server/domain/operator-publish-control-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

const applicationIdSchema = z.string().uuid();

export async function POST(request: Request, context: { params: Promise<{ applicationId: string }> }) {
  try {
    const { applicationId } = await context.params;
    const reviewer = await getRateLimitedCurrentUser();
    return Response.json(await suspendOperatorApplication(
      getPrisma(),
      reviewer,
      applicationIdSchema.parse(applicationId),
      operatorApplicationSuspendInputSchema.parse(await request.json()),
    ));
  } catch (error) {
    return handleApiError(error);
  }
}
