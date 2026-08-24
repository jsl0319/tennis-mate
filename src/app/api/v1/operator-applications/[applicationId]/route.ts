import { getRateLimitedCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { operatorApplicationInputSchema } from "@/server/domain/operator-application";
import { toOperatorApplicationView, updateOperatorApplication } from "@/server/domain/operator-application-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ applicationId: string }> }) {
  try {
    const { applicationId } = await context.params;
    const user = await getRateLimitedCurrentUser();
    const application = await updateOperatorApplication(
      getPrisma(),
      user,
      applicationId,
      operatorApplicationInputSchema.parse(await request.json()),
    );
    return Response.json(toOperatorApplicationView(application));
  } catch (error) {
    return handleApiError(error);
  }
}
