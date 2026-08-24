import { getRateLimitedCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { createCourtImageUpload } from "@/server/domain/court-image-service";
import { getOnboardedViewer } from "@/server/domain/match-service";
import { DomainError } from "@/server/domain/profile-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getRateLimitedCurrentUser();
    const prisma = getPrisma();
    await getOnboardedViewer(prisma, user);
    const formData = await request.formData();
    const files = formData.getAll("file");
    const file = files[0];
    if (files.length !== 1 || !(file instanceof File)) {
      throw new DomainError("COURT_IMAGE_FILE_REQUIRED", 422, "코트 사진 파일을 선택해 주세요.");
    }
    if ([...formData.keys()].some((key) => key !== "file")) {
      throw new DomainError("INVALID_REQUEST", 400, "코트 사진 파일만 올려 주세요.");
    }

    const upload = await createCourtImageUpload(prisma, user.id, file);
    return Response.json(upload, { status: 201, headers: { Location: `/api/v1/court-image-uploads/${upload.id}` } });
  } catch (error) {
    return handleApiError(error);
  }
}
