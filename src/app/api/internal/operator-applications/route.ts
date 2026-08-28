import { getRateLimitedCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import {
  listOperatorApplicationsForReview,
} from "@/server/domain/operator-application-service";
import { operatorApplicationReviewListQuerySchema } from "@/server/domain/operator-application";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const query = operatorApplicationReviewListQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const reviewer = await getRateLimitedCurrentUser();
    return Response.json(await listOperatorApplicationsForReview(getPrisma(), reviewer, query));
  } catch (error) {
    return handleApiError(error);
  }
}
