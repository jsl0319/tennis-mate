import { getRateLimitedCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { courtSlotIdSchema } from "@/server/domain/court-slot";
import { publishCourtSlot } from "@/server/domain/court-slot-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ slotId: string }> }) {
  try {
    const { slotId } = await context.params;
    const user = await getRateLimitedCurrentUser();
    return Response.json(await publishCourtSlot(getPrisma(), user, courtSlotIdSchema.parse(slotId)));
  } catch (error) {
    return handleApiError(error);
  }
}
