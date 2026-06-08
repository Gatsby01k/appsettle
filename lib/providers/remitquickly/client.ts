import "server-only";

import crypto from "node:crypto";
import { UserFacingError } from "@/lib/errors";

/**
 * Thin server-only client for the RemitQuickly sandbox payout API.
 *
 * Credentials are read exclusively from environment variables and never leave the
 * server. Every request is signed exactly as documented:
 *   payload   = base64( JSON.stringify({ timestamp, body }) )
 *   signature = hex( HMAC-SHA512(payload, apiSecret) )
 * and sent via the X-PAYOUT-APIKEY / X-PAYOUT-PAYLOAD / X-PAYOUT-SIGNATURE headers.
 */

export type RemitQuicklyConfig = {
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
  webhookSecret?: string;
};

export type RemitQuicklyResponse<T = unknown> = {
  ok: boolean;
  status: number;
  data: T;
};

export type ImpsPayoutRequest = {
  merchantRecognitionId: string;
  acc_id: string;
  name: string;
  bank_name: string;
  ifsc: string;
  acc_type: string;
  amount: number;
  mobile: string;
  quote_id: number;
  branch?: string;
  email?: string;
  isTest?: boolean;
  mobile_code?: string;
  remarks?: string;
  sender_details?: Record<string, unknown>;
};

export type OrderStatusQuery = {
  searchBy: "payout_id" | "merchantRecognitionId";
  searchValue: string;
};

export type SimulateOutcome =
  | "SUCCESS"
  | "BANK_OFFLINE"
  | "INVALID_ACCOUNT"
  | "INSUFFICIENT_BALANCE"
  | "TIMEOUT";

const ENDPOINTS = {
  impsPayout: "/payouts/global/impsPayout",
  impsPayoutStatus: "/payouts/global/impsPayout/status",
  setWebhookUrl: "/payouts/global/setPayoutWebhookUrl",
  simulate: "/payouts/global/payout/simulate",
} as const;

/**
 * Reads provider configuration from the environment. Returns null (rather than
 * throwing) when the integration is not configured so callers can degrade
 * gracefully and keep the rest of the app working.
 */
export function getRemitQuicklyConfig(): RemitQuicklyConfig | null {
  const baseUrl = process.env.REMITQUICKLY_BASE_URL?.trim();
  const apiKey = process.env.REMITQUICKLY_API_KEY?.trim();
  const apiSecret = process.env.REMITQUICKLY_API_SECRET?.trim();

  if (!baseUrl || !apiKey || !apiSecret) return null;

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    apiSecret,
    webhookSecret: process.env.REMITQUICKLY_WEBHOOK_SECRET?.trim() || undefined,
  };
}

export function isRemitQuicklyConfigured(): boolean {
  return getRemitQuicklyConfig() !== null;
}

function requireConfig(): RemitQuicklyConfig {
  const config = getRemitQuicklyConfig();
  if (!config) {
    throw new UserFacingError(
      "RemitQuickly is not configured. Set REMITQUICKLY_BASE_URL, REMITQUICKLY_API_KEY and REMITQUICKLY_API_SECRET.",
    );
  }
  return config;
}

function signRequest(config: RemitQuicklyConfig, body: unknown) {
  const payloadObject = { timestamp: Date.now(), body };
  const payload = Buffer.from(JSON.stringify(payloadObject)).toString("base64");
  const signature = crypto.createHmac("sha512", config.apiSecret).update(payload).digest("hex");
  return { payload, signature };
}

async function postSigned<T>(path: string, body: unknown): Promise<RemitQuicklyResponse<T>> {
  const config = requireConfig();
  const { payload, signature } = signRequest(config, body);

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}${path}`, {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json;charset=UTF-8",
        "X-PAYOUT-APIKEY": config.apiKey,
        "X-PAYOUT-PAYLOAD": payload,
        "X-PAYOUT-SIGNATURE": signature,
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new UserFacingError(
      `Could not reach RemitQuickly: ${error instanceof Error ? error.message : "network error"}.`,
    );
  }

  const text = await response.text();
  let data: T;
  try {
    data = (text ? JSON.parse(text) : null) as T;
  } catch {
    data = { raw: text } as unknown as T;
  }

  return { ok: response.ok, status: response.status, data };
}

export function submitImpsPayout(input: ImpsPayoutRequest) {
  return postSigned(ENDPOINTS.impsPayout, input);
}

export function getOrderStatus(query: OrderStatusQuery) {
  return postSigned(ENDPOINTS.impsPayoutStatus, query);
}

export function setWebhookUrl(payoutWebhookUrl: string) {
  return postSigned(ENDPOINTS.setWebhookUrl, { payoutWebhookUrl });
}

/** Sandbox-only: forces a specific outcome for a pending/processing payout. */
export function simulatePayoutOutcome(payoutId: number | string, outcome: SimulateOutcome) {
  return postSigned(ENDPOINTS.simulate, { payout_id: payoutId, outcome });
}

/**
 * Pulls the provider-assigned payout id out of a submit/status response.
 * The API wraps results as `{ status, code, data: [{ payout_id }] }`.
 */
export function extractPayoutId(data: unknown): number | null {
  const record = Array.isArray((data as { data?: unknown[] })?.data)
    ? ((data as { data: Array<{ payout_id?: number }> }).data[0] ?? null)
    : null;
  const payoutId = record?.payout_id;
  return typeof payoutId === "number" ? payoutId : null;
}

/**
 * Verifies an inbound webhook using the documented scheme:
 * signature = hex( HMAC-SHA512(payloadHeader, secret) ).
 * Prefers REMITQUICKLY_WEBHOOK_SECRET, falling back to the API secret (which is
 * what the provider signs payout webhooks with by default).
 */
export function verifyWebhookSignature(payloadHeader: string, signatureHeader: string): boolean {
  const config = getRemitQuicklyConfig();
  if (!config || !payloadHeader || !signatureHeader) return false;

  const secret = config.webhookSecret ?? config.apiSecret;
  const expected = crypto.createHmac("sha512", secret).update(payloadHeader).digest("hex");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(signatureHeader, "utf8");
  if (expectedBuffer.length !== providedBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

export function decodeWebhookPayload(payloadHeader: string): Record<string, unknown> {
  const json = Buffer.from(payloadHeader, "base64").toString("utf8");
  const parsed = JSON.parse(json);
  // The provider may wrap the record as { body, timestamp } or send it flat.
  if (parsed && typeof parsed === "object" && "body" in parsed && typeof parsed.body === "object") {
    return parsed.body as Record<string, unknown>;
  }
  return parsed as Record<string, unknown>;
}
