import { OrganizationStatus, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";

async function main() {
  const passwordHash = await bcrypt.hash("ChangeMe123!", 12);

  const user = await prisma.user.upsert({
    where: { email: "ops@inrsettle.com" },
    update: {},
    create: {
      email: "ops@inrsettle.com",
      name: "INRSettle Operator",
      passwordHash,
      mfaEnabled: true,
    },
  });

  const organization = await prisma.organization.upsert({
    where: { id: "demo-org" },
    update: {},
    create: {
      id: "demo-org",
      legalName: "INRSettle Demo Payments Pvt Ltd",
      displayName: "INRSettle Demo",
      country: "IN",
      status: OrganizationStatus.ACTIVE,
      settlementLimit: "10000000",
      dailyLimit: "50000000",
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: organization.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      organizationId: organization.id,
      role: Role.OWNER,
    },
  });

  await prisma.organizationSettings.upsert({
    where: { organizationId: organization.id },
    update: {},
    create: {
      organizationId: organization.id,
      approvalThreshold: "2500000",
      quoteTtlSeconds: 900,
      reconciliationEmail: "finance@inrsettle.com",
      webhookUrl: "https://example.com/webhooks/inrsettle",
    },
  });

  console.log("Seeded demo login: ops@inrsettle.com / ChangeMe123!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
