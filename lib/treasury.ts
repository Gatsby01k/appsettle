// Treasury reference + demo data layer.
//
// Counterparties, accounts and balances are served from this typed in-repo
// source so the platform is immediately "alive" for demos without requiring a
// database migration. Settlements, quotes, reconciliation and audit logs remain
// fully database-backed via Prisma. See README / roadmap for persisting these.

export type EntityStatus = "ACTIVE" | "PENDING" | "SUSPENDED";

export type Counterparty = {
  id: string;
  name: string;
  type: "Exchange" | "PSP" | "Banking partner" | "Internal";
  status: EntityStatus;
  country: string;
  corridor: "INR_USDT" | "USDT_INR";
  settledVolume: number;
  notes: string;
  accountIds: string[];
};

export type AccountType = "Operating" | "Settlement" | "Treasury wallet" | "Merchant pool" | "Reserve";

export type TreasuryAccount = {
  id: string;
  name: string;
  type: AccountType;
  currency: "INR" | "USDT" | "USDC";
  status: EntityStatus;
  balance: number;
  institution: string;
};

export const COUNTERPARTIES: Counterparty[] = [
  {
    id: "cp_buyucoin",
    name: "BuyUcoin",
    type: "Exchange",
    status: "ACTIVE",
    country: "India",
    corridor: "USDT_INR",
    settledVolume: 184_500_000,
    notes: "Primary INR liquidity venue for USDT off-ramp settlements.",
    accountIds: ["acc_usdt_treasury", "acc_inr_settlement"],
  },
  {
    id: "cp_transactbridge",
    name: "TransactBridge",
    type: "PSP",
    status: "ACTIVE",
    country: "Singapore",
    corridor: "INR_USDT",
    settledVolume: 96_200_000,
    notes: "Cross-border PSP routing merchant collections into USDT.",
    accountIds: ["acc_inr_operating", "acc_usdt_treasury"],
  },
  {
    id: "cp_razorpayx",
    name: "RazorpayX",
    type: "Banking partner",
    status: "ACTIVE",
    country: "India",
    corridor: "INR_USDT",
    settledVolume: 142_750_000,
    notes: "Nodal banking rail for INR payouts and operating float.",
    accountIds: ["acc_inr_operating", "acc_inr_settlement", "acc_merchant_pool"],
  },
  {
    id: "cp_internal_treasury",
    name: "Internal Treasury",
    type: "Internal",
    status: "ACTIVE",
    country: "India",
    corridor: "INR_USDT",
    settledVolume: 58_900_000,
    notes: "Internal book transfers between operating and settlement pools.",
    accountIds: ["acc_inr_operating", "acc_usdc_reserve"],
  },
  {
    id: "cp_nodal_partner",
    name: "Meridian Nodal Bank",
    type: "Banking partner",
    status: "PENDING",
    country: "India",
    corridor: "INR_USDT",
    settledVolume: 0,
    notes: "Secondary nodal partner in onboarding / KYB review.",
    accountIds: [],
  },
];

export const ACCOUNTS: TreasuryAccount[] = [
  {
    id: "acc_inr_operating",
    name: "INR Operating Account",
    type: "Operating",
    currency: "INR",
    status: "ACTIVE",
    balance: 48_250_000,
    institution: "RazorpayX",
  },
  {
    id: "acc_inr_settlement",
    name: "INR Settlement Account",
    type: "Settlement",
    currency: "INR",
    status: "ACTIVE",
    balance: 12_800_000,
    institution: "RazorpayX",
  },
  {
    id: "acc_usdt_treasury",
    name: "USDT Treasury Wallet",
    type: "Treasury wallet",
    currency: "USDT",
    status: "ACTIVE",
    balance: 1_450_000,
    institution: "Fireblocks vault",
  },
  {
    id: "acc_merchant_pool",
    name: "Merchant Pool",
    type: "Merchant pool",
    currency: "INR",
    status: "ACTIVE",
    balance: 8_400_000,
    institution: "RazorpayX",
  },
  {
    id: "acc_usdc_reserve",
    name: "USDC Reserve",
    type: "Reserve",
    currency: "USDC",
    status: "ACTIVE",
    balance: 320_000,
    institution: "Fireblocks vault",
  },
];

export function availableBalance(currency: "INR" | "USDT" | "USDC") {
  return ACCOUNTS.filter((account) => account.currency === currency && account.status === "ACTIVE").reduce(
    (sum, account) => sum + account.balance,
    0,
  );
}

export function defaultAccountsForCorridor(corridor: "INR_USDT" | "USDT_INR") {
  if (corridor === "INR_USDT") {
    return { sourceAccount: "INR Operating Account", targetAccount: "USDT Treasury Wallet" };
  }
  return { sourceAccount: "USDT Treasury Wallet", targetAccount: "INR Settlement Account" };
}

export function counterpartyForCorridor(corridor: "INR_USDT" | "USDT_INR") {
  return COUNTERPARTIES.find((cp) => cp.corridor === corridor && cp.status === "ACTIVE") ?? COUNTERPARTIES[0];
}

export function accountsForCounterparty(counterparty: Counterparty) {
  return ACCOUNTS.filter((account) => counterparty.accountIds.includes(account.id));
}

export function counterpartiesForAccount(account: TreasuryAccount) {
  return COUNTERPARTIES.filter((cp) => cp.accountIds.includes(account.id));
}

// --- Access control role model -------------------------------------------------

export type AccessRole = "OWNER" | "APPROVER" | "OPERATOR" | "VIEWER";

export const ACCESS_ROLES: { role: AccessRole; description: string; permissions: string[] }[] = [
  {
    role: "OWNER",
    description: "Full control over the organization, billing, members and treasury policy.",
    permissions: ["Manage members & roles", "Approve settlements", "Create & operate", "Edit settings", "View everything"],
  },
  {
    role: "APPROVER",
    description: "Reviews and approves settlements above the approval threshold.",
    permissions: ["Approve settlements", "Create & operate", "View everything"],
  },
  {
    role: "OPERATOR",
    description: "Creates quotes and settlements and runs day-to-day reconciliation.",
    permissions: ["Create quotes & settlements", "Execute & settle", "Add reconciliation", "View operations"],
  },
  {
    role: "VIEWER",
    description: "Read-only access for finance, audit and compliance review.",
    permissions: ["View dashboards & reports", "View audit trail"],
  },
];

export type TeamMember = {
  name: string;
  email: string;
  role: AccessRole;
  status: EntityStatus;
  lastActive: string;
};

export const DEMO_TEAM: TeamMember[] = [
  { name: "Aarav Mehta", email: "aarav@inrsettle.com", role: "APPROVER", status: "ACTIVE", lastActive: "2 hours ago" },
  { name: "Diya Nair", email: "diya@inrsettle.com", role: "OPERATOR", status: "ACTIVE", lastActive: "18 minutes ago" },
  { name: "Rohan Iyer", email: "rohan@inrsettle.com", role: "OPERATOR", status: "ACTIVE", lastActive: "1 day ago" },
  { name: "Compliance Desk", email: "compliance@inrsettle.com", role: "VIEWER", status: "ACTIVE", lastActive: "4 hours ago" },
  { name: "Kabir Shah", email: "kabir@inrsettle.com", role: "VIEWER", status: "PENDING", lastActive: "Invited" },
];

// --- API surface for the in-app developer reference ----------------------------

export type ApiEndpoint = {
  method: "GET" | "POST";
  path: string;
  description: string;
  request?: string;
  response: string;
};

export const API_ENDPOINTS: ApiEndpoint[] = [
  {
    method: "POST",
    path: "/v1/quotes",
    description: "Create an executable corridor quote with a locked rate and TTL.",
    request: `{
  "corridor": "INR_USDT",
  "sourceAmount": 5000000,
  "settlementWindow": "same_day"
}`,
    response: `{
  "id": "qt_8fa21",
  "corridor": "INR_USDT",
  "rate": "83.50000000",
  "sourceAmount": "5000000.00",
  "targetAmount": "59820.45",
  "feeBps": 45,
  "status": "ACTIVE",
  "expiresAt": "2026-06-02T12:15:00Z"
}`,
  },
  {
    method: "POST",
    path: "/v1/settlements",
    description: "Create a settlement from an accepted quote and enter the lifecycle.",
    request: `{
  "quoteId": "qt_8fa21",
  "reference": "psp_batch_1842",
  "sourceAccount": "INR Operating Account",
  "targetAccount": "USDT Treasury Wallet"
}`,
    response: `{
  "id": "set_19c33",
  "publicId": "SET-9F2A",
  "status": "REQUESTED",
  "reference": "psp_batch_1842",
  "corridor": "INR_USDT"
}`,
  },
  {
    method: "POST",
    path: "/v1/reconciliation",
    description: "Ingest an external reference and match it against a settlement.",
    request: `{
  "externalRef": "UTR202606020001",
  "source": "bank_statement",
  "amount": 5000000,
  "currency": "INR",
  "settlementId": "set_19c33",
  "valueDate": "2026-06-02",
  "status": "MATCHED"
}`,
    response: `{
  "id": "rec_4ab90",
  "status": "MATCHED",
  "settlementId": "set_19c33",
  "settlementStatus": "RECONCILED"
}`,
  },
  {
    method: "GET",
    path: "/v1/audit",
    description: "Stream the immutable audit trail for compliance review.",
    response: `{
  "data": [
    {
      "action": "settlement.transition",
      "actor": "ops@inrsettle.com",
      "resourceType": "settlement",
      "createdAt": "2026-06-02T11:42:10Z"
    }
  ],
  "nextCursor": null
}`,
  },
  {
    method: "GET",
    path: "/v1/balances",
    description: "Read available treasury balances across fiat and stablecoin accounts.",
    response: `{
  "available": {
    "INR": "69450000.00",
    "USDT": "1450000.000000",
    "USDC": "320000.000000"
  }
}`,
  },
  {
    method: "GET",
    path: "/v1/counterparties",
    description: "List settlement counterparties and their corridors.",
    response: `{
  "data": [
    { "id": "cp_buyucoin", "name": "BuyUcoin", "status": "ACTIVE", "corridor": "USDT_INR" }
  ]
}`,
  },
];
