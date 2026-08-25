import { getRateLimitedCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { courtSlotCreateInputSchema, courtSlotIdSchema } from "@/server/domain/court-slot";
import { createCourtSlot } from "@/server/domain/court-slot-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ courtId: string }> }) {
  try {
    const { courtId } = await context.params;
    const user = await getRateLimitedCurrentUser();
    return Response.json(
      await createCourtSlot(
        getPrisma(),
        user,
        courtSlotIdSchema.parse(courtId),
        courtSlotCreateInputSchema.parse(await request.json()),
      ),
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
