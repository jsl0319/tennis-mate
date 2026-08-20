import { getCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { matchApplicationInputSchema } from "@/server/domain/match";
import { createApplication, getOnboardedViewer, getReceivedApplications } from "@/server/domain/match-service";
import { DomainError } from "@/server/domain/profile-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

const applicationStatuses = ["PENDING", "ACCEPTED", "REJECTED", "WITHDRAWN", "CANCELLED"] as const;
const defaultStatuses = ["PENDING"] as const;

export async function GET(request: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    const { matchId } = await context.params;
    const statusParam = new URL(request.url).searchParams.get("status");
    const statuses: Array<(typeof applicationStatuses)[number]> = statusParam
      ? statusParam.split(",").filter((status): status is (typeof applicationStatuses)[number] => applicationStatuses.includes(status as (typeof applicationStatuses)[number]))
      : [...defaultStatuses];
    if (statusParam && statuses.length === 0) throw new DomainError("INVALID_REQUEST", 400, "신청 상태를 다시 선택해 주세요.");
    const user = await getCurrentUser();
    const prisma = getPrisma();
    const viewer = await getOnboardedViewer(prisma, user);
    return Response.json(await getReceivedApplications(prisma, viewer, matchId, statuses));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    const { matchId } = await context.params;
    const user = await getCurrentUser();
    const prisma = getPrisma();
    const viewer = await getOnboardedViewer(prisma, user);
    const application = await createApplication(prisma, viewer, matchId, matchApplicationInputSchema.parse(await request.json()));
    return Response.json(application, { status: 201, headers: { Location: `/api/v1/matches/${matchId}/applications/${application.id}` } });
  } catch (error) {
    return handleApiError(error);
  }
}
