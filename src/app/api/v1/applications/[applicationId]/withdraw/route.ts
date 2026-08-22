import { getRateLimitedCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { getOnboardedViewer, withdrawApplication } from "@/server/domain/match-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ applicationId: string }> }) {
  try {
    const { applicationId } = await context.params;
    const user = await getRateLimitedCurrentUser();
    const prisma = getPrisma();
    return Response.json(await withdrawApplication(prisma, await getOnboardedViewer(prisma, user), applicationId));
  } catch (error) {
    return handleApiError(error);
  }
}
