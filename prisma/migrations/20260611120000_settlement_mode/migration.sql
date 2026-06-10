-- Settlement test mode for the real-money shadow test:
--   DEMO      — fake/demo data; no real-world money anywhere
--   SHADOW    — real-world operation tracked by INRSettle while a partner/
--               provider moves the money EXTERNALLY (INRSettle never moves
--               funds directly)
--   LIVE_TEST — tiny, capped, manually guarded provider test
--
-- Additive-only: every existing settlement (all demo/sandbox data) defaults to
-- DEMO. No existing table, column, or enum is modified.
CREATE TYPE "SettlementTestMode" AS ENUM ('DEMO', 'SHADOW', 'LIVE_TEST');

ALTER TABLE "Settlement" ADD COLUMN "mode" "SettlementTestMode" NOT NULL DEFAULT 'DEMO';
