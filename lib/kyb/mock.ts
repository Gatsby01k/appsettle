// KYB / Counterparty Readiness — STATIC MOCK DATA ONLY.
//
// Safe, local, display-only data layer for the /kyb page. No I/O, no
// provider calls, no env reads, no database access. Nothing here onboards a
// counterparty, moves funds, or enables live payouts.

export type KybStatus =
  | "Not Started"
  | "Documents Pending"
  | "Under Review"
  | "Approved for Shadow"
  | "Blocked";

export type ChecklistState = "ok" | "pending" | "blocked";

export type KybChecklistItem = {
  label: string;
  value: string;
  state: ChecklistState;
};

export type EligibilityItem = {
  label: string;
  done: boolean;
  note?: string;
};

export type CounterpartyKyb = {
  id: string;
  name: string;
  segment: string;
  status: KybStatus;
  riskRating: "Low" | "Medium" | "High" | "Unrated";
  summary: string;
  reviewOwner: string | null;
  checklist: KybChecklistItem[];
  eligibility: EligibilityItem[];
  missingItems: string[];
};

const ELIGIBILITY_LABELS = {
  legalEntity: "Legal entity verified",
  ownership: "Ownership structure reviewed",
  sourceOfFunds: "Source of funds documented",
  sanctions: "Sanctions/adverse media checked",
  volumes: "Expected volumes within pilot limits",
  providerRoute: "Provider route approved",
  commercial: "Commercial terms mapped",
  reviewOwner: "Manual review owner assigned",
} as const;

export const KYB_COUNTERPARTIES: CounterpartyKyb[] = [
  {
    id: "cp-apex",
    name: "Apex Digital Trading FZE",
    segment: "OTC desk · USDT → INR payouts",
    status: "Approved for Shadow",
    riskRating: "Medium",
    summary:
      "Full KYB pack on file, ownership and source of funds reviewed, screening clear. Approved for capped shadow operations only — live test requires a fresh review at cutover.",
    reviewOwner: "Operations lead (ops@inrsettle.com)",
    checklist: [
      { label: "Company legal name", value: "Apex Digital Trading FZE", state: "ok" },
      { label: "Registration number", value: "DMCC-184421", state: "ok" },
      { label: "Country", value: "United Arab Emirates", state: "ok" },
      { label: "Registered address", value: "On file — license extract verified", state: "ok" },
      { label: "Directors", value: "2 directors documented", state: "ok" },
      { label: "UBOs 10%+", value: "2 UBOs identified (60% / 40%)", state: "ok" },
      { label: "Authorized signatory", value: "Confirmed via board resolution", state: "ok" },
      { label: "Business activity", value: "Proprietary digital-asset trading", state: "ok" },
      { label: "Expected volume", value: "INR 2,000/day pilot cap accepted", state: "ok" },
      { label: "Source of funds", value: "Trading capital — bank letter on file", state: "ok" },
      { label: "Use case", value: "Treasury settlement USDT → INR", state: "ok" },
      { label: "Payer/payee countries", value: "AE → IN only", state: "ok" },
      { label: "Crypto exposure", value: "Declared — exchange + self-custody", state: "ok" },
      { label: "Sanctions/adverse media check", value: "Clear (manual screening, dated)", state: "ok" },
      { label: "Risk rating", value: "Medium — crypto-native counterparty", state: "ok" },
      { label: "Approval decision", value: "Approved for Shadow (capped)", state: "ok" },
    ],
    eligibility: [
      { label: ELIGIBILITY_LABELS.legalEntity, done: true },
      { label: ELIGIBILITY_LABELS.ownership, done: true },
      { label: ELIGIBILITY_LABELS.sourceOfFunds, done: true },
      { label: ELIGIBILITY_LABELS.sanctions, done: true },
      { label: ELIGIBILITY_LABELS.volumes, done: true },
      { label: ELIGIBILITY_LABELS.providerRoute, done: false, note: "Provider commercial review pending (see Provider Risk Shield)" },
      { label: ELIGIBILITY_LABELS.commercial, done: true },
      { label: ELIGIBILITY_LABELS.reviewOwner, done: true },
    ],
    missingItems: ["Provider route approval pending — counterparty ready, rail is not"],
  },
  {
    id: "cp-meridian",
    name: "Meridian Exports Pvt Ltd",
    segment: "Importer/exporter · INR beneficiary",
    status: "Documents Pending",
    riskRating: "Unrated",
    summary:
      "Initial contact complete and use case mapped. Core KYB documents outstanding — ownership pack and source of funds explanation requested.",
    reviewOwner: "Operations lead (ops@inrsettle.com)",
    checklist: [
      { label: "Company legal name", value: "Meridian Exports Pvt Ltd", state: "ok" },
      { label: "Registration number", value: "CIN pending verification", state: "pending" },
      { label: "Country", value: "India", state: "ok" },
      { label: "Registered address", value: "Stated — proof pending", state: "pending" },
      { label: "Directors", value: "Director list not yet provided", state: "pending" },
      { label: "UBOs 10%+", value: "Ownership documents pending", state: "blocked" },
      { label: "Authorized signatory", value: "Not yet designated", state: "pending" },
      { label: "Business activity", value: "Textile export settlement", state: "ok" },
      { label: "Expected volume", value: "Stated INR 1,500/day — within pilot cap", state: "ok" },
      { label: "Source of funds", value: "Source of funds explanation required", state: "blocked" },
      { label: "Use case", value: "Receiving INR settlement proceeds", state: "ok" },
      { label: "Payer/payee countries", value: "AE → IN declared", state: "ok" },
      { label: "Crypto exposure", value: "None declared — to confirm", state: "pending" },
      { label: "Sanctions/adverse media check", value: "Sanctions screening pending", state: "pending" },
      { label: "Risk rating", value: "Unrated — awaiting documents", state: "pending" },
      { label: "Approval decision", value: "Documents Pending", state: "pending" },
    ],
    eligibility: [
      { label: ELIGIBILITY_LABELS.legalEntity, done: false, note: "Registration proof outstanding" },
      { label: ELIGIBILITY_LABELS.ownership, done: false, note: "Ownership documents pending" },
      { label: ELIGIBILITY_LABELS.sourceOfFunds, done: false, note: "Source of funds explanation required" },
      { label: ELIGIBILITY_LABELS.sanctions, done: false, note: "Sanctions screening pending" },
      { label: ELIGIBILITY_LABELS.volumes, done: true },
      { label: ELIGIBILITY_LABELS.providerRoute, done: false, note: "Awaiting KYB completion" },
      { label: ELIGIBILITY_LABELS.commercial, done: false, note: "Commercial terms not accepted" },
      { label: ELIGIBILITY_LABELS.reviewOwner, done: true },
    ],
    missingItems: [
      "Ownership documents pending",
      "Source of funds explanation required",
      "Sanctions screening pending",
      "Commercial terms not accepted",
    ],
  },
  {
    id: "cp-northgate",
    name: "Northgate Ventures LLC",
    segment: "Introduced counterparty · unverified",
    status: "Blocked",
    riskRating: "High",
    summary:
      "Ownership structure could not be established and the stated use case is inconsistent with declared volumes. Blocked from all pilot activity until a complete KYB pack is provided and re-reviewed.",
    reviewOwner: "Operations lead (ops@inrsettle.com)",
    checklist: [
      { label: "Company legal name", value: "Northgate Ventures LLC", state: "ok" },
      { label: "Registration number", value: "Provided — jurisdiction mismatch", state: "blocked" },
      { label: "Country", value: "Stated US — documents reference SC", state: "blocked" },
      { label: "Registered address", value: "Registered-agent address only", state: "pending" },
      { label: "Directors", value: "Nominee director — principals unknown", state: "blocked" },
      { label: "UBOs 10%+", value: "Ownership documents pending", state: "blocked" },
      { label: "Authorized signatory", value: "Unverified", state: "pending" },
      { label: "Business activity", value: "Stated consulting — unclear", state: "pending" },
      { label: "Expected volume", value: "Requested above pilot limits", state: "blocked" },
      { label: "Source of funds", value: "Source of funds explanation required", state: "blocked" },
      { label: "Use case", value: "Inconsistent with declared activity", state: "blocked" },
      { label: "Payer/payee countries", value: "Multiple, undeclared corridors", state: "blocked" },
      { label: "Crypto exposure", value: "Undeclared", state: "pending" },
      { label: "Sanctions/adverse media check", value: "Adverse media review in progress", state: "pending" },
      { label: "Risk rating", value: "High — opacity of ownership", state: "blocked" },
      { label: "Approval decision", value: "Pilot approval blocked", state: "blocked" },
    ],
    eligibility: [
      { label: ELIGIBILITY_LABELS.legalEntity, done: false, note: "Jurisdiction inconsistency unresolved" },
      { label: ELIGIBILITY_LABELS.ownership, done: false, note: "Ownership documents pending" },
      { label: ELIGIBILITY_LABELS.sourceOfFunds, done: false, note: "Source of funds explanation required" },
      { label: ELIGIBILITY_LABELS.sanctions, done: false, note: "Adverse media review in progress" },
      { label: ELIGIBILITY_LABELS.volumes, done: false, note: "Requested volume exceeds pilot limits" },
      { label: ELIGIBILITY_LABELS.providerRoute, done: false, note: "Pilot approval blocked" },
      { label: ELIGIBILITY_LABELS.commercial, done: false, note: "Commercial terms not accepted" },
      { label: ELIGIBILITY_LABELS.reviewOwner, done: true },
    ],
    missingItems: [
      "Ownership documents pending",
      "Source of funds explanation required",
      "Commercial terms not accepted",
      "Pilot approval blocked",
    ],
  },
];
