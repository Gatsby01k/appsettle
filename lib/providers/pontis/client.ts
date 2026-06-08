import "server-only";

import crypto from "node:crypto";
import { UserFacingError } from "@/lib/errors";

/**
 * Thin server-only client for the PontisGlobe sandbox API.
 *
 * Credentials are read exclusively from environment variables and never leave
 * the server. Every request is encrypted + signed exactly as documented:
 *   1. Encrypt the JSON body with AES-256-GCM (random 12-byte IV). The blob is
 *      `iv:tag:ciphertext`, each component base64url-encoded.
 *   2. Sign the literal string `"${timestamp}.${encryptedBody}"` with
 *      HMAC-SHA256 (hex-encoded).
 *   3. POST `{ "data": encryptedBody }` with the x-api-key / x-timestamp /
 *      x-signature headers (and a Bearer JWT on every endpoint except login).
 *
 * Both the encryption secret and the HMAC secret are base64url-encoded values;
 * they are decoded to raw bytes before use (the encryption secret decodes to 32
 * bytes for AES-256).
 *
 * Docs: https://docs.pontisglobe.com/authentication
 */

export type PontisConfig = {
  baseUrl: string;
  apiKey: string;
  /** base64url-encoded, decodes to exactly 32 bytes. */
  encryptionSecret: string;
  /** base64url-encoded HMAC-SHA256 key. */
  hmacSecret: string;
  email: string;
  password: string;
};

export type PontisResponse<T = unknown> = {
  ok: boolean;
  status: number;
  data: T;
};

export type PontisLoginData = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
};

export type PontisEnvelope<T> = {
  ok?: boolean;
  data?: T;
  error?: unknown;
  code?: string;
};

export type PontisRecipientDetails = {
  name: string;
  account_number: string;
  ifsc?: string;
  [key: string]: unknown;
};

export type PontisPayoutRequest = {
  idempotency_key: string;
  country_code: string;
  currency_code: string;
  payment_method: string;
  source_amount: string;
  source_currency: string;
  recipient_details: PontisRecipientDetails;
};

export type PontisPayoutData = {
  transaction_id?: string;
  status?: string;
  status_message?: string | null;
};

const ENDPOINTS = {
  login: "/api/v1/user/login",
  sendPayoutRequest: "/api/v1/payouts/sendPayoutRequest",
  getPayoutStatus: "/api/v1/payouts/getPayoutStatus",
} as const;

/** Replay window the provider enforces on inbound callbacks (seconds). */
const CALLBACK_MAX_AGE_SECONDS = 300;

/**
 * Reads provider configuration from the environment. Returns null (rather than
 * throwing) when the integration is not configured so callers can degrade
 * gracefully and keep the rest of the app working.
 */
export function getPontisConfig(): PontisConfig | null {
  const baseUrl = process.env.PONTIS_BASE_URL?.trim();
  const apiKey = process.env.PONTIS_API_KEY?.trim();
  const encryptionSecret = process.env.PONTIS_ENCRYPTION_SECRET?.trim();
  const hmacSecret = process.env.PONTIS_HMAC_SECRET?.trim();
  const email = process.env.PONTIS_EMAIL?.trim();
  const password = process.env.PONTIS_PASSWORD;

  if (!baseUrl || !apiKey || !encryptionSecret || !hmacSecret || !email || !password) {
    return null;
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    encryptionSecret,
    hmacSecret,
    email,
    password,
  };
}

export function isPontisConfigured(): boolean {
  return getPontisConfig() !== null;
}

function requireConfig(): PontisConfig {
  const config = getPontisConfig();
  if (!config) {
    throw new UserFacingError(
      "PontisGlobe is not configured. Set PONTIS_BASE_URL, PONTIS_API_KEY, PONTIS_ENCRYPTION_SECRET, PONTIS_HMAC_SECRET, PONTIS_EMAIL and PONTIS_PASSWORD.",
    );
  }
  return config;
}

function decodeEncryptionKey(config: PontisConfig): Buffer {
  const key = Buffer.from(config.encryptionSecret, "base64url");
  if (key.length !== 32) {
    throw new UserFacingError(
      "PONTIS_ENCRYPTION_SECRET must be a base64url value that decodes to exactly 32 bytes.",
    );
  }
  return key;
}

function decodeHmacKey(config: PontisConfig): Buffer {
  const key = Buffer.from(config.hmacSecret, "base64url");
  if (key.length === 0) {
    throw new UserFacingError("PONTIS_HMAC_SECRET must be a non-empty base64url value.");
  }
  return key;
}

/**
 * Encrypts an arbitrary JSON-serialisable payload with AES-256-GCM and returns
 * the `iv:tag:ciphertext` blob (each component base64url-encoded).
 */
export function encryptPayload(payload: unknown): string {
  const config = requireConfig();
  const key = decodeEncryptionKey(config);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((b) => b.toString("base64url")).join(":");
}

/**
 * Signs the literal string `"${timestamp}.${encryptedBody}"` with HMAC-SHA256
 * using the (base64url-decoded) HMAC secret. Returns the hex digest.
 */
export function signEncryptedPayload(timestamp: string, encryptedBody: string): string {
  const config = requireConfig();
  const key = decodeHmacKey(config);
  return crypto.createHmac("sha256", key).update(`${timestamp}.${encryptedBody}`).digest("hex");
}

/**
 * Core request helper: encrypts the body, signs it, and POSTs the envelope. The
 * JWT is attached on every call except login. Network/transport errors are
 * surfaced as UserFacingError; HTTP-level errors are returned in the response so
 * callers can inspect the provider's error envelope.
 */
export async function pontisCall<T = unknown>(
  path: string,
  body: unknown,
  jwt?: string,
): Promise<PontisResponse<T>> {
  const config = requireConfig();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const encryptedBody = encryptPayload(body);
  const signature = signEncryptedPayload(timestamp, encryptedBody);

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-api-key": config.apiKey,
    "x-timestamp": timestamp,
    "x-signature": signature,
  };
  if (jwt) {
    headers["authorization"] = `Bearer ${jwt}`;
  }

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}${path}`, {
      method: "POST",
      cache: "no-store",
      headers,
      body: JSON.stringify({ data: encryptedBody }),
    });
  } catch (error) {
    throw new UserFacingError(
      `Could not reach PontisGlobe: ${error instanceof Error ? error.message : "network error"}.`,
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

/**
 * Authenticates with the configured email/password and returns the short-lived
 * (15 minute) JWT alongside the raw provider response. The login endpoint is the
 * only one that is NOT sent a Bearer token.
 *
 * Docs: POST /api/v1/user/login
 */
export async function login(): Promise<{
  token: string | null;
  response: PontisResponse<PontisEnvelope<PontisLoginData>>;
}> {
  const config = requireConfig();
  const response = await pontisCall<PontisEnvelope<PontisLoginData>>(ENDPOINTS.login, {
    email: config.email,
    password: config.password,
  });
  const token = extractAccessToken(response.data);
  return { token, response };
}

/** Obtains a JWT or throws a friendly error if the provider rejected login. */
export async function loginOrThrow(): Promise<string> {
  const { token, response } = await login();
  if (!token) {
    throw new UserFacingError(
      `PontisGlobe login failed (status ${response.status}). Check PONTIS_EMAIL / PONTIS_PASSWORD.`,
    );
  }
  return token;
}

/**
 * Submits a payout. Requires a valid JWT (obtain via {@link login}).
 *
 * Docs: POST /api/v1/payouts/sendPayoutRequest
 */
export function sendPayoutRequest(
  input: PontisPayoutRequest,
  jwt: string,
): Promise<PontisResponse<PontisEnvelope<PontisPayoutData>>> {
  return pontisCall<PontisEnvelope<PontisPayoutData>>(ENDPOINTS.sendPayoutRequest, input, jwt);
}

/**
 * Reads the live status for a transaction. Requires a valid JWT.
 *
 * Docs: POST /api/v1/payouts/getPayoutStatus
 */
export function getPayoutStatus(
  transactionId: string,
  jwt: string,
): Promise<PontisResponse<PontisEnvelope<PontisPayoutData>>> {
  return pontisCall<PontisEnvelope<PontisPayoutData>>(
    ENDPOINTS.getPayoutStatus,
    { transaction_id: transactionId },
    jwt,
  );
}

/** Pulls the JWT out of a login response envelope (`{ data: { access_token } }`). */
export function extractAccessToken(data: unknown): string | null {
  const token = (data as PontisEnvelope<PontisLoginData> | null)?.data?.access_token;
  return typeof token === "string" && token.length > 0 ? token : null;
}

/**
 * Verifies an inbound PontisGlobe callback.
 *
 * The provider sends:
 *   x-pontis-timestamp: <unix seconds>
 *   x-pontis-signature: sha256=<hex of HMAC-SHA256(`${ts}.${rawBody}`)>
 *
 * The HMAC key is the base64url-decoded HMAC secret. The signature MUST be
 * computed over the exact raw request bytes (never a re-serialised object) and
 * the timestamp must be within a 5-minute window.
 *
 * Docs: https://docs.pontisglobe.com/callbacks
 */
export function verifyWebhookSignature(
  timestampHeader: string,
  signatureHeader: string,
  rawBody: string,
): boolean {
  const config = getPontisConfig();
  if (!config || !timestampHeader || !signatureHeader) return false;
  if (!signatureHeader.startsWith("sha256=")) return false;

  const age = Math.floor(Date.now() / 1000) - Number(timestampHeader);
  if (!Number.isFinite(age) || age > CALLBACK_MAX_AGE_SECONDS || age < -CALLBACK_MAX_AGE_SECONDS) {
    return false;
  }

  let key: Buffer;
  try {
    key = decodeHmacKey(config);
  } catch {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", key)
    .update(`${timestampHeader}.${rawBody}`)
    .digest("hex");

  let provided: Buffer;
  let expectedBuffer: Buffer;
  try {
    provided = Buffer.from(signatureHeader.slice("sha256=".length), "hex");
    expectedBuffer = Buffer.from(expected, "hex");
  } catch {
    return false;
  }

  if (provided.length !== expectedBuffer.length || provided.length === 0) return false;
  return crypto.timingSafeEqual(provided, expectedBuffer);
}
