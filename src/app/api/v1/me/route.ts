import { getRateLimitedCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { nicknameSchema } from "@/server/domain/profile";
import { getProfile, toProfileView } from "@/server/domain/profile-service";
import { apiError, handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getRateLimitedCurrentUser();
    const profile = await getProfile(getPrisma(), user.id);

    return Response.json({
      id: user.id,
      nickname: user.nickname,
      nicknameConfirmed: user.nicknameConfirmedAt !== null,
      status: user.status,
      onboardingCompleted: user.onboardingCompletedAt !== null,
      tennisProfile: profile ? toProfileView(profile) : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getRateLimitedCurrentUser();
    const body: unknown = await request.json();
    const nickname = nicknameSchema.parse(
      typeof body === "object" && body !== null ? (body as { nickname?: unknown }).nickname : undefined,
    );

    const existing = await getPrisma().user.findFirst({
      where: { nickname, NOT: { id: user.id } },
      select: { id: true },
    });
    if (existing) {
      return apiError(409, "NICKNAME_ALREADY_EXISTS", "이미 사용 중인 닉네임이에요.");
    }

    const updated = await getPrisma().user.update({
      where: { id: user.id },
      data: { nickname, nicknameConfirmedAt: new Date() },
    });

    return Response.json({
      id: updated.id,
      nickname: updated.nickname,
      nicknameConfirmed: true,
      status: updated.status,
      onboardingCompleted: updated.onboardingCompletedAt !== null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
