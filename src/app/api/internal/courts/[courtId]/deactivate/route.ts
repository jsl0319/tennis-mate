import { z } from "zod";

import { getRateLimitedCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { courtDeactivateInputSchema } from "@/server/domain/operator-application";
import { deactivateCourt } from "@/server/domain/operator-publish-control-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

const courtIdSchema = z.string().uuid();

export async function POST(request: Request, context: { params: Promise<{ courtId: string }> }) {
  try {
    const { courtId } = await context.params;
    const reviewer = await getRateLimitedCurrentUser();
    return Response.json(await deactivateCourt(
      getPrisma(),
      reviewer,
      courtIdSchema.parse(courtId),
      courtDeactivateInputSchema.parse(await request.json()),
    ));
  } catch (error) {
    return handleApiError(error);
  }
}
