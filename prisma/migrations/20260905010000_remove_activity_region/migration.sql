-- Remove activity-region selection from tennis profiles and matches.
-- Region's own hierarchy table and its use by Court are unaffected.

-- DropForeignKey
ALTER TABLE "tennis_profile_regions" DROP CONSTRAINT "tennis_profile_regions_tennis_profile_id_fkey";
ALTER TABLE "tennis_profile_regions" DROP CONSTRAINT "tennis_profile_regions_region_code_fkey";

-- DropTable
DROP TABLE "tennis_profile_regions";

-- AlterTable
ALTER TABLE "tennis_profiles" DROP COLUMN "nearby_region_allowed";

-- DropForeignKey
ALTER TABLE "matches" DROP CONSTRAINT "matches_region_code_fkey";

-- DropIndex
DROP INDEX "matches_region_code_status_starts_at_idx";

-- AlterTable
ALTER TABLE "matches" DROP COLUMN "region_code";
