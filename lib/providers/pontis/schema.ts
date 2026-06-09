import { z } from "zod";

/**
 * Validation schemas for the PontisGlobe integration. These mirror the request
 * and callback shapes documented at https://docs.pontisglobe.com.
 */

/** Final callback statuses Pontis emits (in-progress states never call back). */
export const PONTIS_CALLBACK_STATUSES = [
  "completed",
  "failed",
  "reversed",
  "rejected",
  "canceled",
] as const;

/**
 * `source_amount` is a decimal string. In sandbox the trailing cents act as a
 * deterministic trigger code (.00 -> completed, .01 -> insufficient funds, etc).
 */
const amountSchema = z
  .string()
  .regex(/^\d+\.\d{2}$/, "source_amount must be a decimal string with two trailing digits, e.g. \"10.00\".");

export const recipientDetailsSchema = z
  .object({
    name: z.string().min(1).max(140),
    account_number: z.string().min(1).max(64),
    ifsc: z.string().min(1).max(20).optional(),
  })
  .passthrough();

export const payoutRequestSchema = z.object({
  idempotency_key: z.string().min(1),
  country_code: z.string().min(2).max(3),
  currency_code: z.string().min(3).max(3),
  payment_method: z.string().min(1),
  source_amount: amountSchema,
  source_currency: z.string().min(1).max(10),
  recipient_details: recipientDetailsSchema,
});

export const payoutStatusRequestSchema = z.object({
  transaction_id: z.string().min(1),
});

/**
 * Optional overrides accepted by the dev-only test-payout route. Everything is
 * optional — the route fills in the documented INR sandbox defaults.
 */
export const testPayoutOverridesSchema = z.object({
  /**
   * When provided, drives the real settlement lifecycle (execute an APPROVED
   * settlement) instead of running the self-contained connectivity smoke test.
   */
  settlementId: z.string().min(1).optional(),
  idempotency_key: z.string().min(1).optional(),
  country_code: z.string().min(2).max(3).optional(),
  currency_code: z.string().min(3).max(3).optional(),
  payment_method: z.string().min(1).optional(),
  source_amount: amountSchema.optional(),
  source_currency: z.string().min(1).max(10).optional(),
  recipient_details: recipientDetailsSchema.partial().optional(),
  /** When true, immediately poll getPayoutStatus after submitting. */
  pollStatus: z.boolean().optional(),
});

export const webhookPayloadSchema = z.object({
  transaction_id: z.string().min(1),
  status: z.enum(PONTIS_CALLBACK_STATUSES),
  status_message: z.string().nullable().optional(),
});

export type PayoutRequestInput = z.infer<typeof payoutRequestSchema>;
export type PayoutStatusRequestInput = z.infer<typeof payoutStatusRequestSchema>;
export type TestPayoutOverrides = z.infer<typeof testPayoutOverridesSchema>;
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
