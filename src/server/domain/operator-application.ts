import { createHash, createHmac } from "node:crypto";

import { z } from "zod";

const businessRegistrationNumberSchema = z
  .string()
  .trim()
  .transform((value) => value.replaceAll(/\D/g, ""))
  .refine((value) => /^\d{10}$/.test(value), "사업자등록번호는 숫자 10자리로 입력해 주세요.");

const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replaceAll(/\D/g, ""))
  .refine((value) => /^01\d{8,9}$/.test(value), "운영자 연락처를 다시 확인해 주세요.");

export const operatorApplicationInputSchema = z.object({
  businessName: z.string().trim().min(1, "사업자명을 입력해 주세요.").max(100, "사업자명은 100자 이하여야 해요."),
  businessRegistrationNumber: businessRegistrationNumberSchema,
  businessOpenedOn: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "개업일은 YYYY-MM-DD 형식으로 입력해 주세요."),
  representativeName: z.string().trim().min(1, "대표자명을 입력해 주세요.").max(100, "대표자명은 100자 이하여야 해요."),
  venueName: z.string().trim().min(1, "테니스장 이름을 입력해 주세요.").max(100, "테니스장 이름은 100자 이하여야 해요."),
  venueAddress: z.string().trim().min(1, "테니스장 주소를 입력해 주세요.").max(255, "테니스장 주소는 255자 이하여야 해요."),
  operatorPhone: phoneSchema,
});

export type OperatorApplicationInput = z.infer<typeof operatorApplicationInputSchema>;

export type ProviderVerificationResult = {
  business: "VERIFIED" | "MISMATCH" | "UNAVAILABLE";
  venue: "MATCHED" | "REVIEW_REQUIRED" | "UNAVAILABLE" | "PENDING";
  providerRequestRef?: string;
};

export interface OperatorVerificationProvider {
  verify(input: OperatorApplicationInput): Promise<ProviderVerificationResult>;
}

/**
 * Production-safe default until NTS/address/place providers and their data-processing
 * agreement are approved. It deliberately does not make an external request.
 */
export const manualVerificationProvider: OperatorVerificationProvider = {
  async verify() {
    return { business: "UNAVAILABLE", venue: "UNAVAILABLE", providerRequestRef: "manual-verification" };
  },
};

export function createBusinessRegistrationNumberHash(value: string) {
  const key = process.env.OPERATOR_APPLICATION_HMAC_SECRET ?? process.env.AUTH_SECRET;

  if (!key) {
    throw new Error("운영자 신청을 안전하게 처리할 서버 설정이 필요해요.");
  }

  return createHmac("sha256", key).update(value).digest("hex");
}

export function normalizeVenueKey(venueName: string, venueAddress: string) {
  const normalizePart = (value: string) => value.normalize("NFKC").replaceAll(/\s+/g, "").toLocaleLowerCase("ko-KR");
  const normalizedVenueName = normalizePart(venueName);
  const normalizedVenueAddress = normalizePart(venueAddress);
  const canonicalValue = `${normalizedVenueName.length}:${normalizedVenueName}${normalizedVenueAddress.length}:${normalizedVenueAddress}`;

  return createHash("sha256").update(canonicalValue).digest("hex");
}

export function getVerificationDecision(
  verification: ProviderVerificationResult,
  hasActiveVenueOperator: boolean,
) {
  if (verification.business === "MISMATCH") {
    return {
      status: "REJECTED" as const,
      businessVerificationStatus: "MISMATCH" as const,
      venueVerificationStatus: "PENDING" as const,
      verificationFailureCode: "BUSINESS_MISMATCH",
    };
  }

  if (verification.business === "VERIFIED" && verification.venue === "MATCHED" && !hasActiveVenueOperator) {
    return {
      status: "PUBLISH_APPROVED" as const,
      businessVerificationStatus: "VERIFIED" as const,
      venueVerificationStatus: "MATCHED" as const,
      verificationFailureCode: null,
    };
  }

  if (verification.business === "VERIFIED" && verification.venue === "PENDING") {
    return {
      status: "DRAFT_ACCESS_GRANTED" as const,
      businessVerificationStatus: "VERIFIED" as const,
      venueVerificationStatus: "PENDING" as const,
      verificationFailureCode: null,
    };
  }

  return {
    status: "REVIEW_REQUIRED" as const,
    businessVerificationStatus: verification.business,
    venueVerificationStatus: verification.venue === "MATCHED" && hasActiveVenueOperator ? "REVIEW_REQUIRED" as const : verification.venue,
    verificationFailureCode: verification.business === "UNAVAILABLE" ? "VERIFICATION_UNAVAILABLE" : hasActiveVenueOperator ? "VENUE_ALREADY_ACTIVE" : "VENUE_REVIEW_REQUIRED",
  };
}

export const activeOperatorApplicationStatuses = [
  "DRAFT",
  "VERIFYING",
  "DRAFT_ACCESS_GRANTED",
  "REVIEW_REQUIRED",
  "UNDER_REVIEW",
  "PUBLISH_APPROVED",
  "SUSPENDED",
] as const;
