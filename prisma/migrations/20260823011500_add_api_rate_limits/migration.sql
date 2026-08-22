CREATE TABLE "api_rate_limits" (
    "user_id" UUID NOT NULL,
    "window_started_at" TIMESTAMPTZ(6) NOT NULL,
    "request_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "api_rate_limits_pkey" PRIMARY KEY ("user_id")
);

ALTER TABLE "api_rate_limits"
ADD CONSTRAINT "api_rate_limits_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
