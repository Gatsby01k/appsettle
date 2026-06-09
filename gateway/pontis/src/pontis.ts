import crypto from "node:crypto";

/**
 * Standalone PontisGlobe client for the VPS gateway.
 *
 * This is a self-contained port of the working logic used in the INRSettle app
 * (lib/providers/pontis/client.ts). It deliberately has NO framework imports so
 * it can run as a plain Node process on the whitelisted VPS.
 *
 * Request signing protocol (as documented at https://docs.pontisglobe.com):
 *   1. Encrypt the JSON body with AES-256-GCM (random 12-byte IV). The blob is
 *      `iv:tag:ciphertext`, each component base64url-encoded.
 *   2. Sign the literal string `"${timestamp}.${encryptedBody}"` with
 *      HMAC-SHA256 (hex-encoded).
 *   3. POST `{ "data": encryptedBody }` with the x-api-key / x-timestamp /
 *      x-signature headers (and a Bearer JWT on every endpoint except login).
 *
 * Both secrets are base64url-encoded; they decode to raw bytes before use (the
 * encryption secret decodes to exactly 32 bytes for AES-256).
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

function decodeEncryptionKey(config: PontisConfig): Buffer {
  const key = Buffer.from(config.encryptionSecret, "base64url");
  if (key.length !== 32) {
    throw new Error(
      "PONTIS_ENCRYPTION_SECRET must be a base64url value that decodes to exactly 32 bytes.",
    );
  }
  return key;
}

function decodeHmacKey(config: PontisConfig): Buffer {
  const key = Buffer.from(config.hmacSecret, "base64url");
  if (key.length === 0) {
    throw new Error("PONTIS_HMAC_SECRET must be a non-empty base64url value.");
  }
  return key;
}

/**
 * Encrypts an arbitrary JSON-serialisable payload with AES-256-GCM and returns
 * the `iv:tag:ciphertext` blob (each component base64url-encoded).
 */
export function encryptPayload(config: PontisConfig, payload: unknown): string {
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
export function signEncryptedPayload(
  config: PontisConfig,
  timestamp: string,
  encryptedBody: string,
): string {
  const key = decodeHmacKey(config);
  return crypto.createHmac("sha256", key).update(`${timestamp}.${encryptedBody}`).digest("hex");
}

/**
 * Core request helper: encrypts the body, signs it, and POSTs the envelope. The
 * JWT is attached on every call except login.
 */
export async function pontisCall<T = unknown>(
  config: PontisConfig,
  path: string,
  body: unknown,
  jwt?: string,
): Promise<PontisResponse<T>> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const encryptedBody = encryptPayload(config, body);
  const signature = signEncryptedPayload(config, timestamp, encryptedBody);

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
      headers,
      body: JSON.stringify({ data: encryptedBody }),
    });
  } catch (error) {
    throw new Error(
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
 * JWT alongside the raw provider response. Login is the only endpoint that is
 * NOT sent a Bearer token.
 */
export async function login(config: PontisConfig): Promise<{
  token: string | null;
  response: PontisResponse<PontisEnvelope<PontisLoginData>>;
}> {
  const response = await pontisCall<PontisEnvelope<PontisLoginData>>(config, ENDPOINTS.login, {
    email: config.email,
    password: config.password,
  });
  const token = extractAccessToken(response.data);
  return { token, response };
}

/** Obtains a JWT or throws a friendly error if the provider rejected login. */
export async function loginOrThrow(config: PontisConfig): Promise<string> {
  const { token, response } = await login(config);
  if (!token) {
    throw new Error(
      `PontisGlobe login failed (status ${response.status}). Check PONTIS_EMAIL / PONTIS_PASSWORD.`,
    );
  }
  return token;
}

/**
 * Submits a payout. Requires a valid JWT (obtain via {@link login}).
 * Docs: POST /api/v1/payouts/sendPayoutRequest
 */
export function sendPayoutRequest(
  config: PontisConfig,
  input: PontisPayoutRequest,
  jwt: string,
): Promise<PontisResponse<PontisEnvelope<PontisPayoutData>>> {
  return pontisCall<PontisEnvelope<PontisPayoutData>>(
    config,
    ENDPOINTS.sendPayoutRequest,
    input,
    jwt,
  );
}

/**
 * Reads the live status for a transaction. Requires a valid JWT.
 * Docs: POST /api/v1/payouts/getPayoutStatus
 */
export function getPayoutStatus(
  config: PontisConfig,
  transactionId: string,
  jwt: string,
): Promise<PontisResponse<PontisEnvelope<PontisPayoutData>>> {
  return pontisCall<PontisEnvelope<PontisPayoutData>>(
    config,
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
