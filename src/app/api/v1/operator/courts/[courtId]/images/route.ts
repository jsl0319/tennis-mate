import { getRateLimitedCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { courtIdSchema, operatorCourtImageSaveInputSchema } from "@/server/domain/court-slot";
import {
  createOperatorCourtImageUpload,
  listOperatorCourtImages,
  saveOperatorCourtImages,
} from "@/server/domain/operator-court-image-service";
import { DomainError } from "@/server/domain/profile-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ courtId: string }> }) {
  try {
    const { courtId } = await context.params;
    const user = await getRateLimitedCurrentUser();
    return Response.json(await listOperatorCourtImages(getPrisma(), user, courtIdSchema.parse(courtId)));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ courtId: string }> }) {
  try {
    const { courtId } = await context.params;
    const user = await getRateLimitedCurrentUser();
    const formData = await request.formData();
    const files = formData.getAll("file");
    const file = files[0];
    if (files.length !== 1 || !(file instanceof File)) {
      throw new DomainError("OPERATOR_COURT_IMAGE_FILE_REQUIRED", 422, "코트 사진 파일을 선택해 주세요.");
    }
    if ([...formData.keys()].some((key) => key !== "file")) {
      throw new DomainError("INVALID_REQUEST", 400, "코트 사진 파일만 올려 주세요.");
    }

    const upload = await createOperatorCourtImageUpload(getPrisma(), user, courtIdSchema.parse(courtId), file);
    return Response.json(upload, { status: 201, headers: { Location: `/api/v1/operator/courts/${courtId}/images/${upload.id}` } });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, context: { params: Promise<{ courtId: string }> }) {
  try {
    const { courtId } = await context.params;
    const user = await getRateLimitedCurrentUser();
    return Response.json(await saveOperatorCourtImages(
      getPrisma(),
      user,
      courtIdSchema.parse(courtId),
      operatorCourtImageSaveInputSchema.parse(await request.json()),
    ));
  } catch (error) {
    return handleApiError(error);
  }
}
