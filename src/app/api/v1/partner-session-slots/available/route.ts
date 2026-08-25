import { getRateLimitedCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { getOnboardedViewer } from "@/server/domain/match-service";
import { getPublicCourtSlots } from "@/server/domain/court-slot-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getRateLimitedCurrentUser();
    await getOnboardedViewer(getPrisma(), user);
    return Response.json(await getPublicCourtSlots(getPrisma(), true));
  } catch (error) {
    return handleApiError(error);
  }
}
