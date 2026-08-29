CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "MatchConversationStatus" AS ENUM ('OPEN', 'READ_ONLY', 'ARCHIVED');
CREATE TYPE "MatchConversationMemberRole" AS ENUM ('HOST', 'PARTICIPANT');
CREATE TYPE "MatchChatMessageType" AS ENUM ('USER', 'SYSTEM');
CREATE TYPE "MatchChatMessageVisibility" AS ENUM ('VISIBLE', 'HIDDEN');
CREATE TYPE "MatchChatReportReason" AS ENUM ('HARASSMENT', 'SEXUAL_OR_HATEFUL_CONTENT', 'PERSONAL_INFORMATION', 'SPAM_OR_FRAUD', 'OTHER');
CREATE TYPE "MatchChatReportStatus" AS ENUM ('OPEN', 'RESOLVED');
CREATE TYPE "MatchChatModerationActionType" AS ENUM ('NO_ACTION', 'HIDE_MESSAGE', 'SUSPEND_SENDING', 'SET_READ_ONLY');

ALTER TABLE "matches"
  DROP CONSTRAINT "matches_contact_open_chat_url_check",
  DROP COLUMN "contact_open_chat_url";

CREATE TABLE "match_conversations" (
  "id" UUID NOT NULL,
  "match_id" UUID NOT NULL,
  "status" "MatchConversationStatus" NOT NULL DEFAULT 'OPEN',
  "read_only_at" TIMESTAMPTZ(6),
  "archive_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "match_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "match_conversation_members" (
  "id" UUID NOT NULL,
  "conversation_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role" "MatchConversationMemberRole" NOT NULL,
  "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sending_suspended_at" TIMESTAMPTZ(6),
  "last_read_message_id" UUID,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "match_conversation_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "match_chat_messages" (
  "id" UUID NOT NULL,
  "conversation_id" UUID NOT NULL,
  "sender_user_id" UUID,
  "type" "MatchChatMessageType" NOT NULL DEFAULT 'USER',
  "body" VARCHAR(500) NOT NULL,
  "visibility" "MatchChatMessageVisibility" NOT NULL DEFAULT 'VISIBLE',
  "client_request_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "match_chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "match_chat_reports" (
  "id" UUID NOT NULL,
  "message_id" UUID NOT NULL,
  "reporter_user_id" UUID NOT NULL,
  "reason" "MatchChatReportReason" NOT NULL,
  "description" VARCHAR(200),
  "status" "MatchChatReportStatus" NOT NULL DEFAULT 'OPEN',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMPTZ(6),
  CONSTRAINT "match_chat_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "match_chat_moderation_actions" (
  "id" UUID NOT NULL,
  "report_id" UUID NOT NULL,
  "reviewer_user_id" UUID NOT NULL,
  "action" "MatchChatModerationActionType" NOT NULL,
  "reason" VARCHAR(200),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "match_chat_moderation_actions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "match_conversations_match_id_key" ON "match_conversations"("match_id");
CREATE INDEX "match_conversations_status_archive_at_idx" ON "match_conversations"("status", "archive_at");
CREATE UNIQUE INDEX "match_conversation_members_conversation_id_user_id_key" ON "match_conversation_members"("conversation_id", "user_id");
CREATE INDEX "match_conversation_members_user_id_updated_at_idx" ON "match_conversation_members"("user_id", "updated_at");
CREATE UNIQUE INDEX "match_chat_messages_sender_user_id_client_request_id_key" ON "match_chat_messages"("sender_user_id", "client_request_id");
CREATE INDEX "match_chat_messages_conversation_id_created_at_id_idx" ON "match_chat_messages"("conversation_id", "created_at", "id");
CREATE UNIQUE INDEX "match_chat_reports_message_id_reporter_user_id_key" ON "match_chat_reports"("message_id", "reporter_user_id");
CREATE INDEX "match_chat_reports_status_created_at_idx" ON "match_chat_reports"("status", "created_at");
CREATE INDEX "match_chat_moderation_actions_report_id_created_at_idx" ON "match_chat_moderation_actions"("report_id", "created_at");
CREATE INDEX "match_chat_moderation_actions_reviewer_user_id_created_at_idx" ON "match_chat_moderation_actions"("reviewer_user_id", "created_at" DESC);

ALTER TABLE "match_conversations"
  ADD CONSTRAINT "match_conversations_match_id_fkey"
  FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_conversation_members"
  ADD CONSTRAINT "match_conversation_members_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "match_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_conversation_members"
  ADD CONSTRAINT "match_conversation_members_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_chat_messages"
  ADD CONSTRAINT "match_chat_messages_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "match_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_chat_messages"
  ADD CONSTRAINT "match_chat_messages_sender_user_id_fkey"
  FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_chat_reports"
  ADD CONSTRAINT "match_chat_reports_message_id_fkey"
  FOREIGN KEY ("message_id") REFERENCES "match_chat_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_chat_reports"
  ADD CONSTRAINT "match_chat_reports_reporter_user_id_fkey"
  FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_chat_moderation_actions"
  ADD CONSTRAINT "match_chat_moderation_actions_report_id_fkey"
  FOREIGN KEY ("report_id") REFERENCES "match_chat_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_chat_moderation_actions"
  ADD CONSTRAINT "match_chat_moderation_actions_reviewer_user_id_fkey"
  FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve active, already accepted Matches while the legacy contact column is removed.
-- Past, cancelled, and still-unaccepted Matches intentionally keep no empty room.
INSERT INTO "match_conversations" ("id", "match_id", "status", "read_only_at", "archive_at", "created_at", "updated_at")
SELECT
  gen_random_uuid(),
  "matches"."id",
  'OPEN'::"MatchConversationStatus",
  NULL,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "matches"
WHERE "matches"."status" IN ('OPEN', 'CLOSED')
  AND "matches"."ends_at" > CURRENT_TIMESTAMP - INTERVAL '24 hours'
  AND EXISTS (
    SELECT 1
    FROM "match_applications"
    WHERE "match_applications"."match_id" = "matches"."id"
      AND "match_applications"."status" = 'ACCEPTED'
  )
ON CONFLICT ("match_id") DO NOTHING;

INSERT INTO "match_conversation_members" ("id", "conversation_id", "user_id", "role", "joined_at", "sending_suspended_at", "last_read_message_id", "updated_at")
SELECT
  gen_random_uuid(),
  "match_conversations"."id",
  "matches"."host_user_id",
  'HOST'::"MatchConversationMemberRole",
  CURRENT_TIMESTAMP,
  NULL,
  NULL,
  CURRENT_TIMESTAMP
FROM "match_conversations"
JOIN "matches" ON "matches"."id" = "match_conversations"."match_id"
WHERE "matches"."status" IN ('OPEN', 'CLOSED')
  AND "matches"."ends_at" > CURRENT_TIMESTAMP - INTERVAL '24 hours'
ON CONFLICT ("conversation_id", "user_id") DO NOTHING;

INSERT INTO "match_conversation_members" ("id", "conversation_id", "user_id", "role", "joined_at", "sending_suspended_at", "last_read_message_id", "updated_at")
SELECT
  gen_random_uuid(),
  "match_conversations"."id",
  "match_applications"."applicant_user_id",
  'PARTICIPANT'::"MatchConversationMemberRole",
  CURRENT_TIMESTAMP,
  NULL,
  NULL,
  CURRENT_TIMESTAMP
FROM "match_conversations"
JOIN "matches" ON "matches"."id" = "match_conversations"."match_id"
JOIN "match_applications" ON "match_applications"."match_id" = "matches"."id"
  AND "match_applications"."status" = 'ACCEPTED'
WHERE "matches"."status" IN ('OPEN', 'CLOSED')
  AND "matches"."ends_at" > CURRENT_TIMESTAMP - INTERVAL '24 hours'
ON CONFLICT ("conversation_id", "user_id") DO NOTHING;
