import { getCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { profileInputSchema } from "@/server/domain/profile";
import { saveProfile, toProfileView } from "@/server/domain/profile-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user.nicknameConfirmedAt) {
      return Response.json(
        {
          error: {
            code: "NICKNAME_CONFIRMATION_REQUIRED",
            message: "닉네임을 먼저 확인해 주세요.",
            fieldErrors: [],
          },
        },
        { status: 403 },
      );
    }

    const input = profileInputSchema.parse(await request.json());
    const profile = await saveProfile(getPrisma(), user.id, input);
    return Response.json(toProfileView(profile), { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
