import { getRateLimitedCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { courtSlotIdSchema, courtSlotUpdateInputSchema } from "@/server/domain/court-slot";
import { updateCourtSlot } from "@/server/domain/court-slot-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ slotId: string }> }) {
  try {
    const { slotId } = await context.params;
    const user = await getRateLimitedCurrentUser();
    return Response.json(await updateCourtSlot(
      getPrisma(),
      user,
      courtSlotIdSchema.parse(slotId),
      courtSlotUpdateInputSchema.parse(await request.json()),
    ));
  } catch (error) {
    return handleApiError(error);
  }
}
