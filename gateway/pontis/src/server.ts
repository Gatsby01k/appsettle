import "dotenv/config";

import crypto from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";

import { loadConfig, type GatewayConfig } from "./config.js";
import {
  getPayoutStatus,
  loginOrThrow,
  sendPayoutRequest,
  type PontisPayoutRequest,
} from "./pontis.js";

/**
 * Standalone PontisGlobe gateway.
 *
 * PontisGlobe whitelists this VPS's static IP, so the INRSettle app on Vercel
 * MUST NOT call Pontis directly. Instead Vercel calls this gateway, which holds
 * the Pontis credentials and signs every request. Inbound requests authenticate
 * with the shared secret in the `x-inrsettle-gateway-secret` header.
 *
 *   POST /health          — liveness check (no auth)
 *   POST /pontis/payout   — login + sendPayoutRequest (auth required)
 *   POST /pontis/status   — login + getPayoutStatus (auth required)
 */

export const GATEWAY_SECRET_HEADER = "x-inrsettle-gateway-secret";

const config: GatewayConfig = loadConfig();
const app = express();
app.use(express.json({ limit: "256kb" }));

/** Constant-time comparison of the inbound gateway secret. */
function verifyGatewaySecret(provided: string | undefined): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(config.gatewaySecret);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function requireSecret(req: Request, res: Response, next: NextFunction): void {
  const provided = req.header(GATEWAY_SECRET_HEADER) ?? undefined;
  if (!verifyGatewaySecret(provided)) {
    res.status(401).json({ ok: false, error: "Unauthorized." });
    return;
  }
  next();
}

/** Narrow check that an inbound payout body has the required Pontis fields. */
function parsePayoutRequest(body: unknown): PontisPayoutRequest | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const recipient = b.recipient_details as Record<string, unknown> | undefined;

  const stringFields = [
    "idempotency_key",
    "country_code",
    "currency_code",
    "payment_method",
    "source_amount",
    "source_currency",
  ] as const;
  for (const field of stringFields) {
    if (typeof b[field] !== "string" || !(b[field] as string).length) return null;
  }

  if (
    !recipient ||
    typeof recipient.name !== "string" ||
    typeof recipient.account_number !== "string"
  ) {
    return null;
  }

  return body as PontisPayoutRequest;
}

app.post("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "pontis-gateway", time: new Date().toISOString() });
});

app.post("/pontis/payout", requireSecret, async (req: Request, res: Response) => {
  const payout = parsePayoutRequest(req.body);
  if (!payout) {
    res.status(400).json({ ok: false, error: "Invalid payout request body." });
    return;
  }

  try {
    const jwt = await loginOrThrow(config.pontis);
    const result = await sendPayoutRequest(config.pontis, payout, jwt);
    const data = result.data?.data ?? null;

    res.status(result.ok ? 200 : 502).json({
      ok: result.ok && Boolean(data?.transaction_id),
      transaction_id: data?.transaction_id ?? null,
      status: data?.status ?? null,
      status_message: data?.status_message ?? null,
      provider_response: result.data,
      error: result.ok
        ? null
        : ((result.data?.error as { message?: string } | undefined)?.message ??
          `PontisGlobe rejected the payout (HTTP ${result.status}).`),
    });
  } catch (error) {
    res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : "Gateway error.",
    });
  }
});

app.post("/pontis/status", requireSecret, async (req: Request, res: Response) => {
  const transactionId = (req.body as { transaction_id?: unknown } | undefined)?.transaction_id;
  if (typeof transactionId !== "string" || !transactionId.length) {
    res.status(400).json({ ok: false, error: "transaction_id is required." });
    return;
  }

  try {
    const jwt = await loginOrThrow(config.pontis);
    const result = await getPayoutStatus(config.pontis, transactionId, jwt);
    const data = result.data?.data ?? null;

    res.status(result.ok ? 200 : 502).json({
      ok: result.ok,
      transaction_id: transactionId,
      status: data?.status ?? null,
      status_message: data?.status_message ?? null,
      provider_response: result.data,
      error: result.ok
        ? null
        : `PontisGlobe could not return the status (HTTP ${result.status}).`,
    });
  } catch (error) {
    res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : "Gateway error.",
    });
  }
});

app.listen(config.port, () => {
  console.log(`[pontis-gateway] listening on port ${config.port}`);
});
