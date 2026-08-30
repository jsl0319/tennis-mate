CREATE TYPE "MatchChatImageUploadStatus" AS ENUM ('PENDING', 'ATTACHED', 'CLEANUP_PENDING', 'DELETED');

CREATE TABLE "match_chat_image_uploads" (
  "id" UUID NOT NULL,
  "conversation_id" UUID NOT NULL,
  "owner_user_id" UUID NOT NULL,
  "message_id" UUID,
  "position" INTEGER,
  "private_object_ref" VARCHAR(500) NOT NULL,
  "content_type" VARCHAR(100) NOT NULL,
  "byte_size" INTEGER NOT NULL,
  "status" "MatchChatImageUploadStatus" NOT NULL DEFAULT 'PENDING',
  "attached_at" TIMESTAMPTZ(6),
  "cleanup_claimed_at" TIMESTAMPTZ(6),
  "deleted_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "match_chat_image_uploads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "match_chat_image_uploads_private_object_ref_key" ON "match_chat_image_uploads"("private_object_ref");
CREATE UNIQUE INDEX "match_chat_image_uploads_message_id_position_key" ON "match_chat_image_uploads"("message_id", "position");
CREATE INDEX "match_chat_image_uploads_conversation_id_owner_user_id_status_created_at_idx" ON "match_chat_image_uploads"("conversation_id", "owner_user_id", "status", "created_at");
CREATE INDEX "match_chat_image_uploads_status_created_at_idx" ON "match_chat_image_uploads"("status", "created_at");

ALTER TABLE "match_chat_image_uploads"
  ADD CONSTRAINT "match_chat_image_uploads_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "match_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_chat_image_uploads"
  ADD CONSTRAINT "match_chat_image_uploads_owner_user_id_fkey"
  FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_chat_image_uploads"
  ADD CONSTRAINT "match_chat_image_uploads_message_id_fkey"
  FOREIGN KEY ("message_id") REFERENCES "match_chat_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
