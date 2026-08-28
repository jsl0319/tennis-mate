ALTER TYPE "OperatorApplicationReviewDecision" ADD VALUE 'SUSPEND_PUBLISH';
ALTER TYPE "OperatorApplicationReviewReasonCode" ADD VALUE 'SAFETY_REVIEW';
ALTER TYPE "OperatorApplicationReviewReasonCode" ADD VALUE 'VENUE_CLOSED';

CREATE TYPE "CourtStatus" AS ENUM ('ACTIVE', 'INACTIVE');

ALTER TABLE "courts"
  ADD COLUMN "status" "CourtStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "deactivated_at" TIMESTAMPTZ(6);

CREATE INDEX "courts_status_created_at_idx" ON "courts"("status", "created_at");

CREATE TABLE "court_status_changes" (
  "id" UUID NOT NULL,
  "court_id" UUID NOT NULL,
  "reviewer_user_id" UUID NOT NULL,
  "from_status" "CourtStatus" NOT NULL,
  "to_status" "CourtStatus" NOT NULL,
  "reason_code" "OperatorApplicationReviewReasonCode" NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "court_status_changes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "court_status_changes_court_id_created_at_idx"
  ON "court_status_changes"("court_id", "created_at");
CREATE INDEX "court_status_changes_reviewer_user_id_created_at_idx"
  ON "court_status_changes"("reviewer_user_id", "created_at" DESC);

ALTER TABLE "court_status_changes"
  ADD CONSTRAINT "court_status_changes_court_id_fkey"
  FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "court_status_changes"
  ADD CONSTRAINT "court_status_changes_reviewer_user_id_fkey"
  FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
