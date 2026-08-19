CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'WITHDRAWN');
CREATE TYPE "ExperienceRange" AS ENUM ('UNDER_3_MONTHS', 'MONTHS_3_TO_6', 'MONTHS_6_TO_12', 'YEARS_1_TO_2', 'YEARS_2_PLUS');
CREATE TYPE "RallyLevel" AS ENUM ('STARTING', 'SHORT_RALLY', 'COMFORTABLE_RALLY', 'STANDARD_RALLY');
CREATE TYPE "GameExperience" AS ENUM ('NONE', 'KNOWS_RULES', 'PLAYED_FEW', 'CAN_PLAY');
CREATE TYPE "PlayPurpose" AS ENUM ('CASUAL_HIT', 'RALLY_PRACTICE', 'STROKE_PRACTICE', 'GAME_INTRO', 'GAME');
CREATE TYPE "RegionType" AS ENUM ('CITY', 'DISTRICT');

CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "nickname" VARCHAR(12) NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "nickname_confirmed_at" TIMESTAMPTZ(6),
    "onboarding_completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "auth_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" VARCHAR(30) NOT NULL,
    "provider_account_id" VARCHAR(191) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auth_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tennis_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "experience_range" "ExperienceRange" NOT NULL,
    "rally_level" "RallyLevel" NOT NULL,
    "game_experience" "GameExperience" NOT NULL,
    "skill_label" VARCHAR(30),
    "nearby_region_allowed" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "tennis_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "regions" (
    "code" VARCHAR(30) NOT NULL,
    "parent_code" VARCHAR(30),
    "name" VARCHAR(50) NOT NULL,
    "short_name" VARCHAR(30),
    "type" "RegionType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "regions_pkey" PRIMARY KEY ("code")
);

CREATE TABLE "tennis_profile_regions" (
    "tennis_profile_id" UUID NOT NULL,
    "region_code" VARCHAR(30) NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "tennis_profile_regions_pkey" PRIMARY KEY ("tennis_profile_id", "region_code")
);

CREATE TABLE "tennis_profile_purposes" (
    "tennis_profile_id" UUID NOT NULL,
    "purpose" "PlayPurpose" NOT NULL,
    CONSTRAINT "tennis_profile_purposes_pkey" PRIMARY KEY ("tennis_profile_id", "purpose")
);

CREATE UNIQUE INDEX "users_nickname_key" ON "users"("nickname");
CREATE INDEX "auth_accounts_user_id_idx" ON "auth_accounts"("user_id");
CREATE UNIQUE INDEX "auth_accounts_provider_provider_account_id_key" ON "auth_accounts"("provider", "provider_account_id");
CREATE UNIQUE INDEX "tennis_profiles_user_id_key" ON "tennis_profiles"("user_id");
CREATE INDEX "regions_parent_code_active_idx" ON "regions"("parent_code", "active");
CREATE UNIQUE INDEX "regions_parent_code_name_key" ON "regions"("parent_code", "name");
CREATE INDEX "tennis_profile_regions_region_code_tennis_profile_id_idx" ON "tennis_profile_regions"("region_code", "tennis_profile_id");

ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tennis_profiles" ADD CONSTRAINT "tennis_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "regions" ADD CONSTRAINT "regions_parent_code_fkey" FOREIGN KEY ("parent_code") REFERENCES "regions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tennis_profile_regions" ADD CONSTRAINT "tennis_profile_regions_tennis_profile_id_fkey" FOREIGN KEY ("tennis_profile_id") REFERENCES "tennis_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tennis_profile_regions" ADD CONSTRAINT "tennis_profile_regions_region_code_fkey" FOREIGN KEY ("region_code") REFERENCES "regions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tennis_profile_purposes" ADD CONSTRAINT "tennis_profile_purposes_tennis_profile_id_fkey" FOREIGN KEY ("tennis_profile_id") REFERENCES "tennis_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
