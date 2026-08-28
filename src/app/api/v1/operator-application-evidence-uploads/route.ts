import { getRateLimitedCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { createBusinessRegistrationCertificateUpload } from "@/server/domain/operator-application-evidence-service";
import { DomainError } from "@/server/domain/profile-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getRateLimitedCurrentUser();
    const formData = await request.formData();
    const files = formData.getAll("file");
    const file = files[0];
    if (files.length !== 1 || !(file instanceof File)) {
      throw new DomainError("BUSINESS_REGISTRATION_CERTIFICATE_REQUIRED", 422, "사업자등록증 파일을 선택해 주세요.");
    }
    if ([...formData.keys()].some((key) => key !== "file")) {
      throw new DomainError("INVALID_REQUEST", 400, "사업자등록증 파일만 올려 주세요.");
    }

    const upload = await createBusinessRegistrationCertificateUpload(getPrisma(), user.id, file);
    return Response.json(upload, { status: 201, headers: { Location: `/api/v1/operator-application-evidence-uploads/${upload.id}` } });
  } catch (error) {
    return handleApiError(error);
  }
}
