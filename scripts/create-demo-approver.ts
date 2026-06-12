// Creates the real, login-capable demo APPROVER for dual-control testing.
// Idempotent: safe to run any number of times.
//
// Dual-control stays intact: this script only provisions a second user with an
// approver-capable role (TREASURY_MANAGER — allowed by canApproveSettlement,
// without OWNER/ADMIN powers). Creator self-approval remains rejected by the
// approveFinality action; nothing about auth, providers, or payouts changes.
//
// Anchoring: the approver joins the EXACT organization of the anchor operator
// (NEXT_PUBLIC_DEMO_EMAIL, default ops@inrsettle.com — the seed operator).
// It never anchors to demo@inrsettle.com or "the first org" while the anchor
// operator exists, and it never creates a new organization.
//
// Run with: npm run demo:approver   (or: npx tsx scripts/create-demo-approver.ts)

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

const APPROVER_EMAIL = "approver@inrsettle.com";
const APPROVER_NAME = "INRSettle Demo Approver";
const APPROVER_PASSWORD = "DemoApprover123!";
const APPROVER_ROLE = Role.TREASURY_MANAGER;

// The operator whose organization the approver must share. Defaults to the
// seed operator (ops@inrsettle.com), NOT demo@inrsettle.com.
const ANCHOR_EMAIL = process.env.NEXT_PUBLIC_DEMO_EMAIL ?? "ops@inrsettle.com";

/**
 * Resolve the organization the approver must join: the anchor operator's own
 * membership. Fallbacks (oldest org) apply ONLY when the anchor user does not
 * exist or has no membership — never while the anchor is usable.
 */
async function resolveAnchorOrganization() {
  const anchorUser = await prisma.user.findUnique({ where: { email: ANCHOR_EMAIL } });

  if (anchorUser) {
    const anchorMembership = await prisma.membership.findFirst({
      where: { userId: anchorUser.id },
      orderBy: { createdAt: "asc" },
      include: { organization: true },
    });
    if (anchorMembership) {
      return {
        organization: anchorMembership.organization,
        anchorUserId: anchorUser.id,
        anchoredVia: `membership of ${ANCHOR_EMAIL}`,
      };
    }
    console.warn(`WARNING: ${ANCHOR_EMAIL} exists but has NO membership — falling back.`);
  } else {
    console.warn(`WARNING: anchor user ${ANCHOR_EMAIL} not found — falling back.`);
  }

  // Fallback only (anchor unusable). Never creates a new organization.
  const oldest = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (oldest) {
    return { organization: oldest, anchorUserId: null, anchoredVia: "oldest organization (fallback)" };
  }

  throw new Error(
    `No organization found and anchor ${ANCHOR_EMAIL} is unusable. ` +
      "Run `npm run prisma:seed` first to create the demo workspace.",
  );
}

async function main() {
  const { organization, anchorUserId, anchoredVia } = await resolveAnchorOrganization();

  // Same hashing approach as prisma/seed.ts: bcrypt, cost factor 12.
  const passwordHash = await bcrypt.hash(APPROVER_PASSWORD, 12);

  // Idempotent: re-running refreshes name/password, never duplicates the user.
  const approver = await prisma.user.upsert({
    where: { email: APPROVER_EMAIL },
    update: { name: APPROVER_NAME, passwordHash },
    create: {
      email: APPROVER_EMAIL,
      name: APPROVER_NAME,
      passwordHash,
      mfaEnabled: false,
    },
  });

  // Ensure membership in the anchor's EXACT organization. Idempotent on the
  // (userId, organizationId) unique constraint; corrects the role if needed.
  // Memberships in other orgs are left untouched (listed below).
  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: approver.id,
        organizationId: organization.id,
      },
    },
    update: { role: APPROVER_ROLE },
    create: {
      userId: approver.id,
      organizationId: organization.id,
      role: APPROVER_ROLE,
    },
  });

  // ----- Optional cleanup: drop the approver's NON-anchor memberships -------
  // Off by default. Only ever touches THIS demo approver's memberships, never
  // the anchor membership, never other users, never organizations themselves.
  // Fixes the stale active-org problem: a session pinned to an old org makes
  // settlements in the anchor org 404. Idempotent (second run deletes nothing).
  if (process.env.CLEAN_APPROVER_EXTRA_MEMBERSHIPS === "true") {
    const extras = await prisma.membership.findMany({
      where: { userId: approver.id, organizationId: { not: organization.id } },
      include: { organization: true },
    });
    if (extras.length === 0) {
      console.log("Cleanup: no extra approver memberships to remove.");
    } else {
      await prisma.membership.deleteMany({
        where: { userId: approver.id, organizationId: { not: organization.id } },
      });
      console.log(`Cleanup: removed ${extras.length} extra approver membership(s):`);
      for (const m of extras) {
        console.log(`  - removed organizationId ${m.organizationId} (${m.organization.displayName})`);
      }
      console.log("NOTE: the approver must log out and back in — the session JWT pins the");
      console.log("organizationId at login, and a removed membership now fails requireSession.");
    }
    console.log("");
  }

  // ----- Diagnostics: prove the approver shares the operator's org ----------
  const [allApproverMemberships, settlementCount, latestSettlements] = await Promise.all([
    prisma.membership.findMany({
      where: { userId: approver.id },
      include: { organization: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.settlement.count({ where: { organizationId: organization.id } }),
    prisma.settlement.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, publicId: true, status: true, testMode: true },
    }),
  ]);

  console.log("Demo approver ready (dual-control second operator).");
  console.log("");
  console.log("Anchor");
  console.log(`  Anchor email:           ${ANCHOR_EMAIL}`);
  console.log(`  Anchor user id:         ${anchorUserId ?? "(not found — fallback used)"}`);
  console.log(`  Anchor organizationId:  ${organization.id} (${organization.displayName})`);
  console.log(`  Anchored via:           ${anchoredVia}`);
  console.log("");
  console.log("Approver");
  console.log(`  Approver email:         ${APPROVER_EMAIL}`);
  console.log(`  Approver user id:       ${approver.id}`);
  console.log(`  Approver organizationId:${organization.id}`);
  console.log(`  Role:                   ${APPROVER_ROLE} (can approve settlements & finality)`);
  console.log(`  Password:               ${APPROVER_PASSWORD}`);
  console.log("");
  console.log(`All approver memberships (${allApproverMemberships.length}; none deleted):`);
  for (const m of allApproverMemberships) {
    const shared = m.organizationId === organization.id ? "  <-- shared with anchor" : "";
    console.log(`  - ${m.organizationId} (${m.organization.displayName}) role=${m.role}${shared}`);
  }
  console.log("");
  console.log(`Settlements visible in shared organization: ${settlementCount}`);
  if (latestSettlements.length > 0) {
    console.log("Latest 5 settlements in shared organization:");
    for (const s of latestSettlements) {
      console.log(`  - ${s.publicId} (id=${s.id}) status=${s.status} mode=${s.testMode}`);
    }
  } else {
    console.log("No settlements in the shared organization yet — create one as the operator first.");
  }
  console.log("");
  console.log("Dual-control flow: create/prepare the settlement as the operator, then log in");
  console.log('as this approver and use the Shadow console\'s "Approve finality" action.');
  console.log("Creator self-approval remains rejected server-side.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
