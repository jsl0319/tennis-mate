import { getCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { getHostedMatches, getOnboardedViewer } from "@/server/domain/match-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const viewer = await getOnboardedViewer(getPrisma(), user);
    return Response.json({ items: await getHostedMatches(getPrisma(), viewer) });
  } catch (error) { return handleApiError(error); }
}
