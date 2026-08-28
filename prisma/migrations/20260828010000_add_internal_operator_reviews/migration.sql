CREATE TYPE "UserRole" AS ENUM ('MEMBER', 'INTERNAL_REVIEWER');
CREATE TYPE "OperatorApplicationReviewDecision" AS ENUM ('APPROVE_PUBLISH', 'REQUEST_CHANGES', 'REJECT');
CREATE TYPE "OperatorApplicationReviewReasonCode" AS ENUM (
  'MANUAL_VERIFIED',
  'INFORMATION_INCOMPLETE',
  'BUSINESS_UNVERIFIED',
  'VENUE_UNVERIFIED',
  'OPERATING_AUTHORITY_UNCONFIRMED',
  'DUPLICATE_VENUE'
);

ALTER TABLE "users" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'MEMBER';

CREATE TABLE "operator_application_reviews" (
  "id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "reviewer_user_id" UUID NOT NULL,
  "decision" "OperatorApplicationReviewDecision" NOT NULL,
  "reason_code" "OperatorApplicationReviewReasonCode" NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "operator_application_reviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "operator_application_reviews_application_id_created_at_idx" ON "operator_application_reviews"("application_id", "created_at");
CREATE INDEX "operator_application_reviews_reviewer_user_id_created_at_idx" ON "operator_application_reviews"("reviewer_user_id", "created_at" DESC);
CREATE UNIQUE INDEX "court_operator_applications_approved_venue_key" ON "court_operator_applications"("normalized_venue_key") WHERE "status" = 'PUBLISH_APPROVED';

ALTER TABLE "operator_application_reviews" ADD CONSTRAINT "operator_application_reviews_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "court_operator_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "operator_application_reviews" ADD CONSTRAINT "operator_application_reviews_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
