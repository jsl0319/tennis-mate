import { getRateLimitedCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { matchApplicationDecisionInputSchema } from "@/server/domain/match";
import { acceptApplication, getOnboardedViewer } from "@/server/domain/match-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ applicationId: string }> }) {
  try {
    const { applicationId } = await context.params;
    const user = await getRateLimitedCurrentUser();
    const prisma = getPrisma();
    const viewer = await getOnboardedViewer(prisma, user);
    return Response.json(await acceptApplication(prisma, viewer, applicationId, matchApplicationDecisionInputSchema.parse(await request.json())));
  } catch (error) {
    return handleApiError(error);
  }
}
