-- Persist which payout provider executed a settlement and the provider-side
-- transaction id, so the lifecycle (Execute -> Check status -> Settle) and
-- inbound webhooks can map a provider transaction back to its settlement.
ALTER TABLE "Settlement" ADD COLUMN "provider" TEXT;
ALTER TABLE "Settlement" ADD COLUMN "providerTransactionId" TEXT;

CREATE INDEX "Settlement_providerTransactionId_idx" ON "Settlement"("providerTransactionId");
