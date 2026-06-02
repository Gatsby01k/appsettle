import { z } from "zod";

export const quoteSchema = z.object({
  corridor: z.enum(["INR_USDT", "USDT_INR"]),
  sourceAmount: z.coerce.number().positive().max(100_000_000),
  settlementWindow: z.enum(["instant", "same_day", "next_day"]).default("same_day"),
});

export const settlementSchema = z.object({
  quoteId: z.string().min(1),
  reference: z.string().min(3).max(80),
  sourceAccount: z.string().min(3).max(160),
  targetAccount: z.string().min(3).max(160),
});

export const reconciliationSchema = z.object({
  externalRef: z.string().min(3).max(100),
  source: z.enum(["bank_statement", "chain_tx", "psp_report", "manual"]),
  amount: z.coerce.number().positive(),
  currency: z.enum(["INR", "USDT"]),
  settlementId: z.string().optional(),
  valueDate: z.string().min(10),
  status: z.enum(["OPEN", "MATCHED", "PARTIALLY_MATCHED", "UNMATCHED", "EXCEPTION", "RESOLVED"]),
  exceptionReason: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.status === "EXCEPTION" && !data.exceptionReason?.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["exceptionReason"],
      message: "Exception reason is required when status is EXCEPTION.",
    });
  }

  if (data.status !== "EXCEPTION" && data.exceptionReason?.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["exceptionReason"],
      message: "Exception reason can only be used when status is EXCEPTION.",
    });
  }

  if (data.status === "MATCHED" && !data.settlementId) {
    ctx.addIssue({
      code: "custom",
      path: ["settlementId"],
      message: "A MATCHED reconciliation record must be linked to a settlement.",
    });
  }

  if (data.status === "EXCEPTION" && data.settlementId) {
    ctx.addIssue({
      code: "custom",
      path: ["settlementId"],
      message: "An EXCEPTION reconciliation record cannot be linked to a settlement.",
    });
  }

  if (data.status === "UNMATCHED" && data.settlementId) {
    ctx.addIssue({
      code: "custom",
      path: ["settlementId"],
      message: "An UNMATCHED reconciliation record cannot be linked to a settlement.",
    });
  }
});

export const settingsSchema = z.object({
  displayName: z.string().min(2).max(100),
  approvalThreshold: z.coerce.number().positive(),
  quoteTtlSeconds: z.coerce.number().int().min(60).max(3600),
  reconciliationEmail: z.string().email().optional().or(z.literal("")),
  webhookUrl: z.string().url().optional().or(z.literal("")),
});
