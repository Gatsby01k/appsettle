-- Normalize settlement lifecycle to:
-- CREATED -> APPROVED -> EXECUTING -> SETTLED -> RECONCILED
--
-- Existing pre-approval states are preserved as CREATED. No rows are deleted.
-- Legacy terminal states cannot be mapped without losing meaning, so the migration
-- stops if such rows exist and asks operators to resolve them manually.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Settlement"
    WHERE "status" IN ('FAILED', 'CANCELLED')
  ) OR EXISTS (
    SELECT 1
    FROM "SettlementEvent"
    WHERE "fromStatus" IN ('FAILED', 'CANCELLED')
       OR "toStatus" IN ('FAILED', 'CANCELLED')
  ) THEN
    RAISE EXCEPTION 'Cannot normalize settlement lifecycle while FAILED or CANCELLED settlement states exist.';
  END IF;
END $$;

UPDATE "Settlement"
SET "status" = 'CREATED'
WHERE "status" IN ('REQUESTED', 'QUOTED', 'PENDING_APPROVAL', 'ON_HOLD');

UPDATE "SettlementEvent"
SET "fromStatus" = 'CREATED'
WHERE "fromStatus" IN ('REQUESTED', 'QUOTED', 'PENDING_APPROVAL', 'ON_HOLD');

UPDATE "SettlementEvent"
SET "toStatus" = 'CREATED'
WHERE "toStatus" IN ('REQUESTED', 'QUOTED', 'PENDING_APPROVAL', 'ON_HOLD');

ALTER TABLE "Settlement" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Settlement" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;
ALTER TABLE "SettlementEvent" ALTER COLUMN "fromStatus" TYPE TEXT USING "fromStatus"::TEXT;
ALTER TABLE "SettlementEvent" ALTER COLUMN "toStatus" TYPE TEXT USING "toStatus"::TEXT;

DROP TYPE "SettlementStatus";
CREATE TYPE "SettlementStatus" AS ENUM ('CREATED', 'APPROVED', 'EXECUTING', 'SETTLED', 'RECONCILED');

ALTER TABLE "Settlement" ALTER COLUMN "status" TYPE "SettlementStatus" USING "status"::"SettlementStatus";
ALTER TABLE "SettlementEvent" ALTER COLUMN "fromStatus" TYPE "SettlementStatus" USING "fromStatus"::"SettlementStatus";
ALTER TABLE "SettlementEvent" ALTER COLUMN "toStatus" TYPE "SettlementStatus" USING "toStatus"::"SettlementStatus";
ALTER TABLE "Settlement" ALTER COLUMN "status" SET DEFAULT 'CREATED';
