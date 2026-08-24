CREATE TYPE "OperatorApplicationStatus" AS ENUM (
  'DRAFT', 'VERIFYING', 'DRAFT_ACCESS_GRANTED', 'REVIEW_REQUIRED', 'UNDER_REVIEW',
  'CHANGES_REQUESTED', 'PUBLISH_APPROVED', 'REJECTED', 'SUSPENDED'
);

CREATE TYPE "BusinessVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'MISMATCH', 'UNAVAILABLE');
CREATE TYPE "VenueVerificationStatus" AS ENUM ('PENDING', 'MATCHED', 'REVIEW_REQUIRED', 'UNAVAILABLE');
CREATE TYPE "VerificationAttemptKind" AS ENUM ('BUSINESS', 'VENUE');
CREATE TYPE "VerificationAttemptResult" AS ENUM ('VERIFIED', 'MISMATCH', 'UNAVAILABLE', 'REVIEW_REQUIRED', 'PENDING');

CREATE TABLE "court_operator_applications" (
  "id" UUID NOT NULL,
  "applicant_user_id" UUID NOT NULL,
  "status" "OperatorApplicationStatus" NOT NULL DEFAULT 'DRAFT',
  "business_name" VARCHAR(100) NOT NULL,
  "business_registration_number_hash" VARCHAR(128) NOT NULL,
  "verification_input_ref" VARCHAR(255),
  "business_verification_status" "BusinessVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "venue_verification_status" "VenueVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "venue_name" VARCHAR(100) NOT NULL,
  "venue_address" VARCHAR(255) NOT NULL,
  "normalized_venue_key" VARCHAR(255) NOT NULL,
  "verification_failure_code" VARCHAR(60),
  "submitted_at" TIMESTAMPTZ(6),
  "verified_at" TIMESTAMPTZ(6),
  "publish_approved_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "court_operator_applications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "operator_application_verification_attempts" (
  "id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "kind" "VerificationAttemptKind" NOT NULL,
  "result" "VerificationAttemptResult" NOT NULL,
  "safe_failure_code" VARCHAR(60),
  "provider_request_ref" VARCHAR(120),
  "attempted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "operator_application_verification_attempts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "court_operator_applications_applicant_user_id_created_at_idx" ON "court_operator_applications"("applicant_user_id", "created_at" DESC);
CREATE INDEX "court_operator_applications_business_registration_number_hash_status_idx" ON "court_operator_applications"("business_registration_number_hash", "status");
CREATE INDEX "court_operator_applications_normalized_venue_key_status_idx" ON "court_operator_applications"("normalized_venue_key", "status");
CREATE INDEX "operator_application_verification_attempts_application_id_attempted_at_idx" ON "operator_application_verification_attempts"("application_id", "attempted_at" DESC);

ALTER TABLE "court_operator_applications" ADD CONSTRAINT "court_operator_applications_applicant_user_id_fkey" FOREIGN KEY ("applicant_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "operator_application_verification_attempts" ADD CONSTRAINT "operator_application_verification_attempts_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "court_operator_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
