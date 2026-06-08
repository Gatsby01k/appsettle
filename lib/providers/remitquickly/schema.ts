import { z } from "zod";

const SIMULATE_OUTCOMES = [
  "SUCCESS",
  "BANK_OFFLINE",
  "INVALID_ACCOUNT",
  "INSUFFICIENT_BALANCE",
  "TIMEOUT",
] as const;

/** Optional beneficiary overrides for the sandbox test payout. */
export const beneficiaryOverridesSchema = z.object({
  acc_id: z.string().min(1).max(64).optional(),
  name: z.string().min(1).max(120).optional(),
  bank_name: z.string().min(1).max(120).optional(),
  ifsc: z.string().min(1).max(20).optional(),
  acc_type: z.string().min(1).max(20).optional(),
  amount: z.coerce.number().positive().max(100_000_000).optional(),
  mobile: z.string().min(1).max(20).optional(),
  quote_id: z.coerce.number().int().positive().optional(),
  email: z.string().email().optional(),
});

export const testPayoutSchema = z.object({
  settlementId: z.string().min(1).optional(),
  outcome: z.enum(SIMULATE_OUTCOMES).default("SUCCESS"),
  overrides: beneficiaryOverridesSchema.optional(),
});

export const setWebhookSchema = z.object({
  url: z.string().url().optional(),
});

export type TestPayoutInput = z.infer<typeof testPayoutSchema>;
export type BeneficiaryOverrides = z.infer<typeof beneficiaryOverridesSchema>;
