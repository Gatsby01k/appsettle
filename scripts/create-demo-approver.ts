// Creates the real, login-capable demo APPROVER for Phase 5 dual-control
// testing. Idempotent: safe to run any number of times.
//
// Dual-control stays intact: this script only provisions a second user with an
// approver-capable role (TREASURY_MANAGER — allowed by canApproveSettlement,
// without OWNER/ADMIN powers). Creator self-approval remains rejected by the
// approveFinality action; nothing about auth, providers, or payouts changes.
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

const DEMO_OPERATOR_EMAIL = process.env.NEXT_PUBLIC_DEMO_EMAIL ?? "demo@inrsettle.com";
const DEMO_ORG_ID = "inrsettle-demo-workspace";

/**
 * The approver must join the SAME workspace as the existing demo operator.
 * Resolution order: the demo operator's organization -> the well-known demo
 * workspace id -> the oldest organization (matching seed-demo behavior).
 */
async function resolveDemoOrganization() {
  const operatorMembership = await prisma.membership.findFirst({
    where: { user: { email: DEMO_OPERATOR_EMAIL } },
    orderBy: { createdAt: "asc" },
    include: { organization: true },
  });
  if (operatorMembership) return operatorMembership.organization;

  const demoOrg = await prisma.organization.findUnique({ where: { id: DEMO_ORG_ID } });
  if (demoOrg) return demoOrg;

  const oldest = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (oldest) return oldest;

  throw new Error(
    "No organization found. Run `npm run prisma:seed` or `npm run demo:user` first to create the demo workspace.",
  );
}

async function main() {
  const organization = await resolveDemoOrganization();

  // Same hashing approach as prisma/seed.ts: bcrypt, cost factor 12.
  const passwordHash = await bcrypt.hash(APPROVER_PASSWORD, 12);

  // Idempotent: re-running refreshes name/password, never duplicates the user.
  const user = await prisma.user.upsert({
    where: { email: APPROVER_EMAIL },
    update: {
      name: APPROVER_NAME,
      passwordHash,
    },
    create: {
      email: APPROVER_EMAIL,
      name: APPROVER_NAME,
      passwordHash,
      mfaEnabled: false,
    },
  });

  // Idempotent on the (userId, organizationId) unique constraint. The update
  // branch also corrects the role if a previous run used a different one.
  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: organization.id,
      },
    },
    update: { role: APPROVER_ROLE },
    create: {
      userId: user.id,
      organizationId: organization.id,
      role: APPROVER_ROLE,
    },
  });

  console.log("Demo approver ready (dual-control second operator).");
  console.log(`  Login:        ${APPROVER_EMAIL}`);
  console.log(`  Password:     ${APPROVER_PASSWORD}`);
  console.log(`  Organization: ${organization.displayName}`);
  console.log(`  Role:         ${APPROVER_ROLE} (can approve settlements & finality)`);
  console.log("");
  console.log("Dual-control flow: create/prepare the LIVE_TEST settlement as the demo");
  console.log("operator, then log in as this approver and use the Shadow console's");
  console.log('"Approve finality" action. Creator self-approval remains rejected.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
