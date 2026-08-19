import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AccountAccessError, AuthenticationError } from "@/server/auth/current-user";
import { DomainError } from "@/server/domain/profile-service";

export function apiError(
  status: number,
  code: string,
  message: string,
  fieldErrors: Array<{ field: string; message: string }> = [],
) {
  return NextResponse.json({ error: { code, message, fieldErrors } }, { status });
}

export function handleApiError(error: unknown) {
  if (error instanceof AuthenticationError) {
    return apiError(401, "UNAUTHENTICATED", error.message);
  }

  if (error instanceof AccountAccessError) {
    return apiError(403, "FORBIDDEN", error.message);
  }

  if (error instanceof DomainError) {
    return apiError(error.status, error.code, error.message);
  }

  if (error instanceof ZodError) {
    return apiError(
      422,
      "VALIDATION_FAILED",
      "입력한 내용을 다시 확인해 주세요.",
      error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })),
    );
  }

  return apiError(500, "INTERNAL_ERROR", "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
}
