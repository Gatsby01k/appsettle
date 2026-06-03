import { Badge } from "@/components/ui/badge";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

// Canonical tone for every status surfaced across the console — settlement
// lifecycle, reconciliation, quotes, accounts, counterparties, and team.
const TONE_BY_STATUS: Record<string, Tone> = {
  // Completed / healthy
  SETTLED: "success",
  RECONCILED: "success",
  APPROVED: "success",
  MATCHED: "success",
  AUTO_MATCHED: "success",
  MANUAL_MATCHED: "success",
  ACTIVE: "success",
  RESOLVED: "success",
  COMPLETED: "success",
  // In-flight / needs attention soon
  EXECUTING: "warning",
  REQUESTED: "warning",
  OPEN: "warning",
  EXPIRED: "warning",
  PARTIALLY_MATCHED: "warning",
  MANUAL_REVIEW: "warning",
  PENDING: "warning",
  ONBOARDING: "warning",
  // Informational / awaiting a decision
  ACCEPTED: "info",
  QUOTED: "info",
  UNMATCHED: "info",
  SUGGESTED: "info",
  SUGGESTED_MATCH: "info",
  PENDING_APPROVAL: "info",
  // Failures / exceptions
  FAILED: "danger",
  CANCELLED: "danger",
  EXCEPTION: "danger",
  REJECTED: "danger",
};

export function StatusBadge({ status, dot = true }: { status: string; dot?: boolean }) {
  const normalized = status.toUpperCase();
  const tone = TONE_BY_STATUS[normalized] ?? "neutral";
  return (
    <Badge tone={tone} dot={dot}>
      {normalized.replaceAll("_", " ")}
    </Badge>
  );
}
