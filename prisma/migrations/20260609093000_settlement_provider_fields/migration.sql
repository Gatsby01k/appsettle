-- Persist which payout provider executed a settlement, the provider-side
-- transaction id, the latest provider status and the raw provider response, so
-- the lifecycle (Execute -> Check status -> Settle) and inbound webhooks can map
-- a provider transaction back to its settlement and keep an auditable record of
-- what the provider (via the VPS gateway) returned.
ALTER TABLE "Settlement" ADD COLUMN "provider" TEXT;
ALTER TABLE "Settlement" ADD COLUMN "providerTransactionId" TEXT;
ALTER TABLE "Settlement" ADD COLUMN "providerStatus" TEXT;
ALTER TABLE "Settlement" ADD COLUMN "providerResponse" JSONB;

CREATE INDEX "Settlement_providerTransactionId_idx" ON "Settlement"("providerTransactionId");
