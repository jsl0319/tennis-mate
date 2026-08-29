import { getRateLimitedCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { internalChatReportListQuerySchema } from "@/server/domain/match-chat";
import { getMatchChatReports } from "@/server/domain/match-chat-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const query = internalChatReportListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const reviewer = await getRateLimitedCurrentUser();
    return Response.json(await getMatchChatReports(getPrisma(), reviewer, query.status));
  } catch (error) {
    return handleApiError(error);
  }
}
