-- Provider proof: structured, append-only evidence of what a payout provider
-- reported about a settlement (transaction id, UTR, status, amount, raw
-- response, and how we received it). Provider status "completed" only means the
-- payout MAY have completed — proof rows are one of the three independent
-- inputs (proof + reconciliation + audit trail) that finality review requires
-- before a settlement is safe to finalize.
--
-- Additive-only: no existing table, column, or enum is modified.
CREATE TYPE "ProofReceivedVia" AS ENUM ('WEBHOOK', 'POLL', 'MANUAL');

CREATE TABLE "ProviderProof" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerTransactionId" TEXT,
    "utr" TEXT,
    "providerStatus" TEXT NOT NULL,
    "actualAmount" DECIMAL(20,6),
    "currency" TEXT,
    "rawResponse" JSONB,
    "receivedVia" "ProofReceivedVia" NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderProof_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProviderProof_settlementId_receivedAt_idx" ON "ProviderProof"("settlementId", "receivedAt");

CREATE INDEX "ProviderProof_provider_providerTransactionId_idx" ON "ProviderProof"("provider", "providerTransactionId");

ALTER TABLE "ProviderProof" ADD CONSTRAINT "ProviderProof_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
