DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'SettlementTestMode'
  ) THEN
    CREATE TYPE "SettlementTestMode" AS ENUM ('DEMO', 'SHADOW', 'LIVE_TEST');
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Settlement'
      AND column_name = 'mode'
  ) THEN
    ALTER TABLE "Settlement" RENAME COLUMN "mode" TO "test_mode";

  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Settlement'
      AND column_name = 'testMode'
  ) THEN
    ALTER TABLE "Settlement" RENAME COLUMN "testMode" TO "test_mode";

  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Settlement'
      AND column_name = 'test_mode'
  ) THEN
    ALTER TABLE "Settlement"
      ADD COLUMN "test_mode" "SettlementTestMode" NOT NULL DEFAULT 'DEMO';
  END IF;
END $$;
