import { getRateLimitedCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { getMyOperatorApplication, toOperatorApplicationView } from "@/server/domain/operator-application-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getRateLimitedCurrentUser();
    return Response.json(toOperatorApplicationView(await getMyOperatorApplication(getPrisma(), user)));
  } catch (error) {
    return handleApiError(error);
  }
}
