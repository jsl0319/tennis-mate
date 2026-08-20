CREATE TYPE "CourtSource" AS ENUM ('EXTERNAL_RESERVED');
CREATE TYPE "PartnerPreference" AS ENUM ('COMPLETE_BEGINNER_WELCOME', 'SIMILAR_LEVEL', 'GAME_CAPABLE');
CREATE TYPE "MatchStatus" AS ENUM ('OPEN', 'CLOSED', 'COMPLETED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'CANCELLED');

CREATE TABLE "matches" (
    "id" UUID NOT NULL,
    "host_user_id" UUID NOT NULL,
    "client_request_id" UUID NOT NULL,
    "region_code" VARCHAR(30) NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "court_source" "CourtSource" NOT NULL DEFAULT 'EXTERNAL_RESERVED',
    "external_court_name" VARCHAR(100) NOT NULL,
    "external_court_address" VARCHAR(255) NOT NULL,
    "external_court_number" VARCHAR(50),
    "recruit_count" INTEGER NOT NULL,
    "partner_preference" "PartnerPreference" NOT NULL,
    "total_court_fee_krw" INTEGER NOT NULL,
    "additional_cost_note" VARCHAR(200),
    "introduction" VARCHAR(300),
    "contact_open_chat_url" VARCHAR(500) NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 1,
    "closed_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "expired_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "cancellation_reason" VARCHAR(200),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "matches_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "matches_starts_at_ends_at_check" CHECK ("starts_at" < "ends_at"),
    CONSTRAINT "matches_recruit_count_check" CHECK ("recruit_count" >= 1),
    CONSTRAINT "matches_total_court_fee_krw_check" CHECK ("total_court_fee_krw" >= 0),
    CONSTRAINT "matches_contact_open_chat_url_check" CHECK ("contact_open_chat_url" ~ '^https://open\\.kakao\\.com/')
);

CREATE TABLE "match_purposes" (
    "match_id" UUID NOT NULL,
    "purpose" "PlayPurpose" NOT NULL,
    CONSTRAINT "match_purposes_pkey" PRIMARY KEY ("match_id", "purpose")
);

CREATE TABLE "match_applications" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "applicant_user_id" UUID NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "message" VARCHAR(200),
    "profile_snapshot" JSONB NOT NULL,
    "profile_snapshot_version" INTEGER NOT NULL DEFAULT 1,
    "decided_at" TIMESTAMPTZ(6),
    "withdrawn_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "match_applications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "matches_host_user_id_client_request_id_key" ON "matches"("host_user_id", "client_request_id");
CREATE INDEX "matches_status_starts_at_idx" ON "matches"("status", "starts_at");
CREATE INDEX "matches_region_code_status_starts_at_idx" ON "matches"("region_code", "status", "starts_at");
CREATE INDEX "matches_host_user_id_status_starts_at_idx" ON "matches"("host_user_id", "status", "starts_at");
CREATE INDEX "match_purposes_purpose_match_id_idx" ON "match_purposes"("purpose", "match_id");
CREATE UNIQUE INDEX "match_applications_match_id_applicant_user_id_key" ON "match_applications"("match_id", "applicant_user_id");
CREATE INDEX "match_applications_match_id_status_created_at_idx" ON "match_applications"("match_id", "status", "created_at");
CREATE INDEX "match_applications_applicant_user_id_status_created_at_idx" ON "match_applications"("applicant_user_id", "status", "created_at" DESC);

ALTER TABLE "matches" ADD CONSTRAINT "matches_host_user_id_fkey" FOREIGN KEY ("host_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "matches" ADD CONSTRAINT "matches_region_code_fkey" FOREIGN KEY ("region_code") REFERENCES "regions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_purposes" ADD CONSTRAINT "match_purposes_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "match_applications" ADD CONSTRAINT "match_applications_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_applications" ADD CONSTRAINT "match_applications_applicant_user_id_fkey" FOREIGN KEY ("applicant_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
