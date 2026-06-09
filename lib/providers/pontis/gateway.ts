import "server-only";

import crypto from "node:crypto";
import { UserFacingError } from "@/lib/errors";
import type { PontisPayoutRequest } from "./client";

/**
 * Vercel-side client for the PontisGlobe VPS gateway.
 *
 * PontisGlobe whitelists the VPS static IP, so the Vercel app MUST NOT talk to
 * Pontis directly. Instead it calls a thin gateway that runs on the whitelisted
 * VPS (see app/pontis/payout and app/pontis/status). Only the gateway holds the
 * Pontis API keys; Vercel only ever knows the gateway URL + a shared secret.
 *
 *   POST ${PONTIS_GATEWAY_URL}/pontis/payout   -> create a payout
 *   POST ${PONTIS_GATEWAY_URL}/pontis/status   -> read a payout status
 *
 * Every call authenticates with the shared secret in the
 * `x-inrsettle-gateway-secret` header.
 */

export const GATEWAY_SECRET_HEADER = "x-inrsettle-gateway-secret";

export type PontisGatewayConfig = {
  url: string;
  secret: string;
};

/** Normalised result of a gateway call, regardless of provider envelope shape. */
export type PontisGatewayResult = {
  ok: boolean;
  status: number;
  transactionId: string | null;
  providerStatus: string | null;
  statusMessage: string | null;
  /** Full provider/gateway response body, persisted on the settlement. */
  response: unknown;
  error: string | null;
};

/** The JSON body the gateway routes return. */
export type GatewayResponseBody = {
  ok?: boolean;
  transaction_id?: string | null;
  status?: string | null;
  status_message?: string | null;
  provider_response?: unknown;
  error?: string | null;
};

/**
 * Reads the gateway configuration from the environment. Returns null (rather than
 * throwing) when the gateway is not configured so callers can degrade gracefully.
 */
export function getPontisGatewayConfig(): PontisGatewayConfig | null {
  const url = process.env.PONTIS_GATEWAY_URL?.trim();
  const secret = process.env.PONTIS_GATEWAY_SECRET?.trim();
  if (!url || !secret) return null;
  return { url: url.replace(/\/+$/, ""), secret };
}

export function isPontisGatewayConfigured(): boolean {
  return getPontisGatewayConfig() !== null;
}

function requireGatewayConfig(): PontisGatewayConfig {
  const config = getPontisGatewayConfig();
  if (!config) {
    throw new UserFacingError(
      "The PontisGlobe gateway is not configured. Set PONTIS_GATEWAY_URL and PONTIS_GATEWAY_SECRET.",
    );
  }
  return config;
}

/**
 * Constant-time verification of an inbound gateway secret. Used by the VPS-side
 * gateway routes to authenticate requests coming from the Vercel app.
 */
export function verifyGatewaySecret(provided: string | null | undefined): boolean {
  const secret = process.env.PONTIS_GATEWAY_SECRET?.trim();
  if (!secret || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function gatewayPost(path: string, body: unknown): Promise<PontisGatewayResult> {
  const config = requireGatewayConfig();

  let response: Response;
  try {
    response = await fetch(`${config.url}${path}`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        [GATEWAY_SECRET_HEADER]: config.secret,
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new UserFacingError(
      `Could not reach the PontisGlobe gateway: ${error instanceof Error ? error.message : "network error"}.`,
    );
  }

  const text = await response.text();
  let data: GatewayResponseBody | null;
  try {
    data = text ? (JSON.parse(text) as GatewayResponseBody) : null;
  } catch {
    data = null;
  }

  return {
    ok: response.ok && data?.ok !== false,
    status: response.status,
    transactionId: data?.transaction_id ?? null,
    providerStatus: data?.status ?? null,
    statusMessage: data?.status_message ?? null,
    response: data?.provider_response ?? data,
    error: data?.error ?? null,
  };
}

/** POST ${PONTIS_GATEWAY_URL}/pontis/payout — create a payout through the gateway. */
export function gatewaySendPayout(payout: PontisPayoutRequest): Promise<PontisGatewayResult> {
  return gatewayPost("/pontis/payout", payout);
}

/** POST ${PONTIS_GATEWAY_URL}/pontis/status — read a payout status through the gateway. */
export function gatewayCheckStatus(transactionId: string): Promise<PontisGatewayResult> {
  return gatewayPost("/pontis/status", { transaction_id: transactionId });
}
