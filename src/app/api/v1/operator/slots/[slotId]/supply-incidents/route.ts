import { getRateLimitedCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { courtSlotIdSchema, courtSupplyIncidentInputSchema } from "@/server/domain/court-slot";
import { reportCourtSupplyIncident } from "@/server/domain/court-slot-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ slotId: string }> }) {
  try {
    const { slotId } = await context.params;
    const user = await getRateLimitedCurrentUser();
    return Response.json(await reportCourtSupplyIncident(
      getPrisma(),
      user,
      courtSlotIdSchema.parse(slotId),
      courtSupplyIncidentInputSchema.parse(await request.json()),
    ));
  } catch (error) {
    return handleApiError(error);
  }
}
