CREATE TYPE "OperatorApplicationEvidenceUploadStatus" AS ENUM ('PENDING', 'ATTACHED', 'REPLACED', 'CLEANUP_PENDING', 'DELETED');

CREATE TABLE "operator_application_evidence_uploads" (
  "id" UUID NOT NULL,
  "owner_user_id" UUID NOT NULL,
  "private_object_ref" VARCHAR(500) NOT NULL,
  "content_type" VARCHAR(100) NOT NULL,
  "byte_size" INTEGER NOT NULL,
  "status" "OperatorApplicationEvidenceUploadStatus" NOT NULL DEFAULT 'PENDING',
  "attached_at" TIMESTAMPTZ(6),
  "expires_at" TIMESTAMPTZ(6),
  "cleanup_claimed_at" TIMESTAMPTZ(6),
  "deleted_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "operator_application_evidence_uploads_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "court_operator_applications" ADD COLUMN "business_registration_certificate_upload_id" UUID;

CREATE UNIQUE INDEX "operator_application_evidence_uploads_private_object_ref_key" ON "operator_application_evidence_uploads"("private_object_ref");
CREATE INDEX "operator_application_evidence_uploads_owner_user_id_status_created_at_idx" ON "operator_application_evidence_uploads"("owner_user_id", "status", "created_at");
CREATE INDEX "operator_application_evidence_uploads_status_expires_at_idx" ON "operator_application_evidence_uploads"("status", "expires_at");
CREATE UNIQUE INDEX "court_operator_applications_business_registration_certificate_upload_id_key" ON "court_operator_applications"("business_registration_certificate_upload_id");

ALTER TABLE "operator_application_evidence_uploads" ADD CONSTRAINT "operator_application_evidence_uploads_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "court_operator_applications" ADD CONSTRAINT "court_operator_applications_business_registration_certificate_upload_id_fkey" FOREIGN KEY ("business_registration_certificate_upload_id") REFERENCES "operator_application_evidence_uploads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
