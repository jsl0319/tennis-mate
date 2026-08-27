CREATE TYPE "CourtSupplyIncidentCode" AS ENUM (
  'SCHEDULE_UNAVAILABLE',
  'FACILITY_CLOSED',
  'SAFETY_RISK',
  'NATURAL_DISASTER',
  'INFORMATION_REVIEW'
);
CREATE TYPE "CourtSupplyIncidentImpact" AS ENUM ('NONE', 'CANCEL_MATCH');
CREATE TYPE "CourtSupplyIncidentStatus" AS ENUM ('REQUESTED', 'WITHDRAWN', 'REVIEWED', 'REJECTED');
CREATE TYPE "OperatorSupplyRestrictionSource" AS ENUM ('AUTOMATED', 'ADMIN');

CREATE TABLE "court_supply_incidents" (
  "id" UUID NOT NULL,
  "court_slot_id" UUID NOT NULL,
  "match_id" UUID NOT NULL,
  "code" "CourtSupplyIncidentCode" NOT NULL,
  "impact" "CourtSupplyIncidentImpact" NOT NULL,
  "status" "CourtSupplyIncidentStatus" NOT NULL DEFAULT 'REQUESTED',
  "operator_attributable" BOOLEAN NOT NULL DEFAULT false,
  "public_notice_code" VARCHAR(60) NOT NULL,
  "reported_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "withdrawn_at" TIMESTAMPTZ(6),
  "reviewed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "court_supply_incidents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "match_supply_notice_recipients" (
  "id" UUID NOT NULL,
  "incident_id" UUID NOT NULL,
  "match_id" UUID NOT NULL,
  "recipient_user_id" UUID NOT NULL,
  "notice_code" VARCHAR(60) NOT NULL,
  "delivered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "match_supply_notice_recipients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "operator_supply_restrictions" (
  "id" UUID NOT NULL,
  "operator_application_id" UUID NOT NULL,
  "source" "OperatorSupplyRestrictionSource" NOT NULL DEFAULT 'AUTOMATED',
  "reason_code" VARCHAR(60) NOT NULL,
  "triggered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cleared_at" TIMESTAMPTZ(6),
  "cleared_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "operator_supply_restrictions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "court_supply_incidents_court_slot_id_created_at_idx" ON "court_supply_incidents"("court_slot_id", "created_at");
CREATE INDEX "court_supply_incidents_match_id_status_idx" ON "court_supply_incidents"("match_id", "status");
CREATE UNIQUE INDEX "match_supply_notice_recipients_incident_id_recipient_user_id_key" ON "match_supply_notice_recipients"("incident_id", "recipient_user_id");
CREATE INDEX "match_supply_notice_recipients_recipient_user_id_delivered_at_idx" ON "match_supply_notice_recipients"("recipient_user_id", "delivered_at" DESC);
CREATE INDEX "match_supply_notice_recipients_match_id_delivered_at_idx" ON "match_supply_notice_recipients"("match_id", "delivered_at" DESC);
CREATE INDEX "operator_supply_restrictions_operator_application_id_cleared_at_idx" ON "operator_supply_restrictions"("operator_application_id", "cleared_at");
CREATE UNIQUE INDEX "operator_supply_restrictions_active_application_key" ON "operator_supply_restrictions"("operator_application_id") WHERE "cleared_at" IS NULL;

ALTER TABLE "court_supply_incidents" ADD CONSTRAINT "court_supply_incidents_court_slot_id_fkey" FOREIGN KEY ("court_slot_id") REFERENCES "court_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "court_supply_incidents" ADD CONSTRAINT "court_supply_incidents_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_supply_notice_recipients" ADD CONSTRAINT "match_supply_notice_recipients_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "court_supply_incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "match_supply_notice_recipients" ADD CONSTRAINT "match_supply_notice_recipients_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "match_supply_notice_recipients" ADD CONSTRAINT "match_supply_notice_recipients_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "operator_supply_restrictions" ADD CONSTRAINT "operator_supply_restrictions_operator_application_id_fkey" FOREIGN KEY ("operator_application_id") REFERENCES "court_operator_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "operator_supply_restrictions" ADD CONSTRAINT "operator_supply_restrictions_cleared_by_user_id_fkey" FOREIGN KEY ("cleared_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
