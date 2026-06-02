import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  const tone =
    ["SETTLED", "RECONCILED", "APPROVED", "MATCHED", "ACTIVE", "RESOLVED"].includes(normalized)
      ? "success"
      : ["FAILED", "CANCELLED", "EXCEPTION", "REJECTED"].includes(normalized)
        ? "danger"
        : ["EXECUTING", "REQUESTED", "OPEN", "PARTIALLY_MATCHED"].includes(normalized)
          ? "warning"
          : ["UNMATCHED", "QUOTED", "PENDING_APPROVAL"].includes(normalized)
            ? "info"
            : "neutral";

  return <Badge tone={tone}>{normalized.replaceAll("_", " ")}</Badge>;
}
