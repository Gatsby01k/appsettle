-- Add per-organization/source/externalRef uniqueness without modifying existing data.
-- If duplicates already exist, stop with a clear error so operators can resolve them manually.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "ReconciliationRecord"
    GROUP BY "organizationId", "source", "externalRef"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add reconciliation uniqueness constraint: duplicate organization/source/externalRef records already exist.';
  END IF;
END $$;

CREATE UNIQUE INDEX "ReconciliationRecord_organizationId_source_externalRef_key"
  ON "ReconciliationRecord" ("organizationId", "source", "externalRef");
