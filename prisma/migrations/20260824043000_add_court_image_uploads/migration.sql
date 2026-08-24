CREATE TYPE "CourtImageUploadStatus" AS ENUM ('PENDING', 'ATTACHED', 'CLEANUP_PENDING', 'DELETED');

CREATE TABLE "court_image_uploads" (
  "id" UUID NOT NULL,
  "owner_user_id" UUID NOT NULL,
  "private_object_ref" VARCHAR(500) NOT NULL,
  "content_type" VARCHAR(100) NOT NULL,
  "byte_size" INTEGER NOT NULL,
  "status" "CourtImageUploadStatus" NOT NULL DEFAULT 'PENDING',
  "attached_at" TIMESTAMPTZ(6),
  "cleanup_claimed_at" TIMESTAMPTZ(6),
  "deleted_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "court_image_uploads_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "matches" ADD COLUMN "external_court_image_upload_id" UUID;

CREATE UNIQUE INDEX "court_image_uploads_private_object_ref_key" ON "court_image_uploads"("private_object_ref");
CREATE INDEX "court_image_uploads_owner_user_id_status_created_at_idx" ON "court_image_uploads"("owner_user_id", "status", "created_at");
CREATE INDEX "court_image_uploads_status_created_at_idx" ON "court_image_uploads"("status", "created_at");
CREATE UNIQUE INDEX "matches_external_court_image_upload_id_key" ON "matches"("external_court_image_upload_id");

ALTER TABLE "court_image_uploads" ADD CONSTRAINT "court_image_uploads_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "matches" ADD CONSTRAINT "matches_external_court_image_upload_id_fkey" FOREIGN KEY ("external_court_image_upload_id") REFERENCES "court_image_uploads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
