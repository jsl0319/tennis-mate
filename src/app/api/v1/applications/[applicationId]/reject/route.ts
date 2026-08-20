import { getCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { getOnboardedViewer, rejectApplication } from "@/server/domain/match-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ applicationId: string }> }) {
  try {
    const { applicationId } = await context.params;
    const user = await getCurrentUser();
    const prisma = getPrisma();
    const viewer = await getOnboardedViewer(prisma, user);
    return Response.json(await rejectApplication(prisma, viewer, applicationId));
  } catch (error) {
    return handleApiError(error);
  }
}
