import { getRateLimitedCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { operatorApplicationInputSchema } from "@/server/domain/operator-application";
import { submitOperatorApplication, toOperatorApplicationView } from "@/server/domain/operator-application-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getRateLimitedCurrentUser();
    const application = await submitOperatorApplication(
      getPrisma(),
      user,
      operatorApplicationInputSchema.parse(await request.json()),
    );
    return Response.json(toOperatorApplicationView(application), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
