ALTER TYPE "CourtSource" ADD VALUE 'COURT_TBD';

ALTER TABLE "matches"
  ALTER COLUMN "external_court_name" DROP NOT NULL,
  ALTER COLUMN "external_court_address" DROP NOT NULL,
  ALTER COLUMN "total_court_fee_krw" DROP NOT NULL;
