import type { PontisConfig } from "./pontis.js";

/**
 * Reads and validates the gateway configuration from the VPS environment.
 *
 * All values are required — the gateway is useless without the Pontis
 * credentials and the shared secret it uses to authenticate the Vercel app.
 */
export type GatewayConfig = {
  port: number;
  /** Shared secret expected in the x-inrsettle-gateway-secret header. */
  gatewaySecret: string;
  pontis: PontisConfig;
};

function required(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

export function loadConfig(): GatewayConfig {
  const port = Number(process.env.PORT ?? 8787);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error("PORT must be a positive number.");
  }

  // Password may legitimately contain leading/trailing spaces, so it is read
  // raw, but it must still be present.
  const password = process.env.PONTIS_PASSWORD;
  if (!password) {
    throw new Error("Missing required environment variable: PONTIS_PASSWORD");
  }

  return {
    port,
    gatewaySecret: required("INRSETTLE_GATEWAY_SECRET"),
    pontis: {
      baseUrl: required("PONTIS_BASE_URL").replace(/\/+$/, ""),
      apiKey: required("PONTIS_API_KEY"),
      encryptionSecret: required("PONTIS_ENCRYPTION_SECRET"),
      hmacSecret: required("PONTIS_HMAC_SECRET"),
      email: required("PONTIS_EMAIL"),
      password,
    },
  };
}
