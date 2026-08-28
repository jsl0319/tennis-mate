CREATE TYPE "CourtImageStatus" AS ENUM ('PENDING', 'ATTACHED', 'REPLACED', 'CLEANUP_PENDING', 'DELETED');

CREATE TABLE "court_images" (
  "id" UUID NOT NULL,
  "court_id" UUID NOT NULL,
  "owner_user_id" UUID NOT NULL,
  "private_object_ref" VARCHAR(500) NOT NULL,
  "content_type" VARCHAR(100) NOT NULL,
  "byte_size" INTEGER NOT NULL,
  "status" "CourtImageStatus" NOT NULL DEFAULT 'PENDING',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_representative" BOOLEAN NOT NULL DEFAULT false,
  "attached_at" TIMESTAMPTZ(6),
  "expires_at" TIMESTAMPTZ(6),
  "cleanup_claimed_at" TIMESTAMPTZ(6),
  "deleted_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "court_images_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "court_images_byte_size_check" CHECK ("byte_size" > 0 AND "byte_size" <= 10485760),
  CONSTRAINT "court_images_sort_order_check" CHECK ("sort_order" >= 0)
);

CREATE UNIQUE INDEX "court_images_private_object_ref_key" ON "court_images"("private_object_ref");
CREATE INDEX "court_images_court_id_status_sort_order_idx" ON "court_images"("court_id", "status", "sort_order");
CREATE INDEX "court_images_owner_user_id_status_created_at_idx" ON "court_images"("owner_user_id", "status", "created_at");
CREATE INDEX "court_images_status_expires_at_idx" ON "court_images"("status", "expires_at");
CREATE UNIQUE INDEX "court_images_one_attached_representative_idx"
  ON "court_images"("court_id")
  WHERE ("status" = 'ATTACHED' AND "is_representative" = true);

ALTER TABLE "court_images" ADD CONSTRAINT "court_images_court_id_fkey"
  FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "court_images" ADD CONSTRAINT "court_images_owner_user_id_fkey"
  FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
