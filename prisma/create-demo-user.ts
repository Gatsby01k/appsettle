import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { OrganizationStatus, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

const DEMO_EMAIL = "demo@inrsettle.com";
const DEMO_NAME = "INRSettle Demo Operator";
const DEMO_PASSWORD = "DemoPass123!";
const DEMO_ORG_ID = "inrsettle-demo-workspace";
const DEMO_ORG_NAME = "INRSettle Demo Workspace";

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {
      name: DEMO_NAME,
      passwordHash,
    },
    create: {
      email: DEMO_EMAIL,
      name: DEMO_NAME,
      passwordHash,
      mfaEnabled: false,
    },
  });

  const organization = await prisma.organization.upsert({
    where: { id: DEMO_ORG_ID },
    update: {},
    create: {
      id: DEMO_ORG_ID,
      legalName: DEMO_ORG_NAME,
      displayName: DEMO_ORG_NAME,
      country: "IN",
      status: OrganizationStatus.ACTIVE,
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

  console.log(`Demo login: ${DEMO_EMAIL}`);
  console.log(`Demo password: ${DEMO_PASSWORD}`);
  console.log(`Demo organization: ${DEMO_ORG_NAME}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
