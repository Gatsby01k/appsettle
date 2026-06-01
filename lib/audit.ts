import { AuditActorType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditInput = {
  action: string;
  resourceType: string;
  resourceId?: string;
  organizationId?: string;
  userId?: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
  requestId?: string;
  actorType?: AuditActorType;
};

export async function writeAuditLog(input: AuditInput) {
  return prisma.auditLog.create({
    data: {
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      organizationId: input.organizationId,
      userId: input.userId,
      before: input.before === undefined ? undefined : JSON.parse(JSON.stringify(input.before)),
      after: input.after === undefined ? undefined : JSON.parse(JSON.stringify(input.after)),
      ipAddress: input.ipAddress,
      requestId: input.requestId,
      actorType: input.actorType ?? AuditActorType.USER,
    },
  });
}
