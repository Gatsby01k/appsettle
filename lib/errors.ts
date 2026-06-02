import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

function targetIncludes(error: Prisma.PrismaClientKnownRequestError, fields: string[]) {
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return fields.every((field) => target.includes(field));
  }

  if (typeof target === "string") {
    return fields.every((field) => target.includes(field));
  }

  return false;
}

export function friendlyErrorMessage(error: unknown) {
  if (error instanceof UserFacingError) return error.message;

  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Please check the submitted values.";
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      if (targetIncludes(error, ["organizationId", "reference"])) {
        return "A settlement with this reference already exists.";
      }

      if (targetIncludes(error, ["organizationId", "source", "externalRef"])) {
        return "A reconciliation record with this external reference already exists for this source.";
      }

      return "A record with these details already exists.";
    }

    if (error.code === "P2025") {
      return "The requested record was not found.";
    }

    return "The request could not be completed. Please check the details and try again.";
  }

  if (error instanceof Error) return error.message;
  return "Unexpected error. Please try again.";
}
