import { getRateLimitedCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { courtSlotListQuerySchema } from "@/server/domain/court-slot";
import { getMyCourtSlots } from "@/server/domain/court-slot-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await getRateLimitedCurrentUser();
    const status = new URL(request.url).searchParams.get("status") ?? undefined;
    return Response.json(await getMyCourtSlots(getPrisma(), user, courtSlotListQuerySchema.parse({ status })));
  } catch (error) {
    return handleApiError(error);
  }
}
