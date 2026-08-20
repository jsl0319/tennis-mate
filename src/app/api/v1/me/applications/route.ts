import { getCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { getOnboardedViewer, getSentApplications } from "@/server/domain/match-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const prisma = getPrisma();
    const viewer = await getOnboardedViewer(prisma, user);
    return Response.json(await getSentApplications(prisma, viewer));
  } catch (error) {
    return handleApiError(error);
  }
}
