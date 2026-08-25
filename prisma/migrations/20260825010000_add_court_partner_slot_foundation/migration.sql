ALTER TYPE "CourtSource" ADD VALUE 'PARTNER_COURT';

CREATE TYPE "CourtSlotVisibility" AS ENUM ('PRIVATE', 'PUBLIC');
CREATE TYPE "CourtSlotStatus" AS ENUM ('DRAFT', 'AVAILABLE', 'ALLOCATED', 'ENDED', 'BLOCKED', 'CANCELLED');
CREATE TYPE "SlotStatusChangeActor" AS ENUM ('OPERATOR', 'SESSION_HOST', 'SYSTEM', 'ADMIN');

CREATE TABLE "courts" (
  "id" UUID NOT NULL,
  "operator_application_id" UUID NOT NULL,
  "region_code" VARCHAR(30) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "address" VARCHAR(255) NOT NULL,
  "normalized_venue_key" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "courts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "court_units" (
  "id" UUID NOT NULL,
  "court_id" UUID NOT NULL,
  "name" VARCHAR(50) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "court_units_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "court_slots" (
  "id" UUID NOT NULL,
  "court_unit_id" UUID NOT NULL,
  "starts_at" TIMESTAMPTZ(6) NOT NULL,
  "ends_at" TIMESTAMPTZ(6) NOT NULL,
  "price_krw" INTEGER NOT NULL,
  "max_participant_count" INTEGER NOT NULL,
  "visibility" "CourtSlotVisibility" NOT NULL DEFAULT 'PRIVATE',
  "status" "CourtSlotStatus" NOT NULL DEFAULT 'DRAFT',
  "published_at" TIMESTAMPTZ(6),
  "status_changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "usage_note" VARCHAR(500),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "court_slots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "court_slots_starts_at_ends_at_check" CHECK ("starts_at" < "ends_at"),
  CONSTRAINT "court_slots_price_krw_check" CHECK ("price_krw" >= 0),
  CONSTRAINT "court_slots_max_participant_count_check" CHECK ("max_participant_count" >= 2),
  CONSTRAINT "court_slots_public_requires_published_at_check" CHECK ("visibility" = 'PRIVATE' OR "published_at" IS NOT NULL)
);

CREATE TABLE "court_slot_status_histories" (
  "id" UUID NOT NULL,
  "court_slot_id" UUID NOT NULL,
  "from_status" "CourtSlotStatus",
  "to_status" "CourtSlotStatus" NOT NULL,
  "actor" "SlotStatusChangeActor" NOT NULL,
  "actor_user_id" UUID,
  "reason_code" VARCHAR(60) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "court_slot_status_histories_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "matches" ADD COLUMN "court_slot_id" UUID;

CREATE UNIQUE INDEX "courts_operator_application_id_key" ON "courts"("operator_application_id");
CREATE UNIQUE INDEX "courts_normalized_venue_key_key" ON "courts"("normalized_venue_key");
CREATE INDEX "courts_region_code_created_at_idx" ON "courts"("region_code", "created_at");
CREATE UNIQUE INDEX "court_units_court_id_name_key" ON "court_units"("court_id", "name");
CREATE INDEX "court_units_court_id_idx" ON "court_units"("court_id");
CREATE INDEX "court_slots_court_unit_id_starts_at_idx" ON "court_slots"("court_unit_id", "starts_at");
CREATE INDEX "court_slots_visibility_status_starts_at_idx" ON "court_slots"("visibility", "status", "starts_at");
CREATE INDEX "court_slot_status_histories_court_slot_id_created_at_idx" ON "court_slot_status_histories"("court_slot_id", "created_at");
CREATE UNIQUE INDEX "matches_court_slot_id_key" ON "matches"("court_slot_id");

ALTER TABLE "courts" ADD CONSTRAINT "courts_operator_application_id_fkey" FOREIGN KEY ("operator_application_id") REFERENCES "court_operator_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "courts" ADD CONSTRAINT "courts_region_code_fkey" FOREIGN KEY ("region_code") REFERENCES "regions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "court_units" ADD CONSTRAINT "court_units_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "court_slots" ADD CONSTRAINT "court_slots_court_unit_id_fkey" FOREIGN KEY ("court_unit_id") REFERENCES "court_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "court_slot_status_histories" ADD CONSTRAINT "court_slot_status_histories_court_slot_id_fkey" FOREIGN KEY ("court_slot_id") REFERENCES "court_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "court_slot_status_histories" ADD CONSTRAINT "court_slot_status_histories_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "matches" ADD CONSTRAINT "matches_court_slot_id_fkey" FOREIGN KEY ("court_slot_id") REFERENCES "court_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "matches" ADD CONSTRAINT "matches_partner_court_source_check"
  CHECK (
    "court_source"::text <> 'PARTNER_COURT'
    OR (
      "court_slot_id" IS NOT NULL
      AND "external_court_name" IS NULL
      AND "external_court_address" IS NULL
      AND "external_court_number" IS NULL
      AND "external_court_image_upload_id" IS NULL
      AND "total_court_fee_krw" IS NOT NULL
      AND "additional_cost_note" IS NULL
    )
  );

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "court_slots" ADD CONSTRAINT "court_slots_unit_time_no_overlap"
  EXCLUDE USING gist (
    "court_unit_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  )
  WHERE ("status" IN ('DRAFT', 'AVAILABLE', 'ALLOCATED'));
