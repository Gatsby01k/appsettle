import { isPontisConfigured } from "./client";

/**
 * The PontisGlobe sandbox test surface (the "Test PontisGlobe Sandbox Payout"
 * button + connectivity smoke test) is intentionally gated. It only appears when
 * the provider is configured AND the app is running in demo / private-beta mode,
 * so it can never be triggered from a public production build.
 *
 * - Explicit opt-in:  PONTIS_SANDBOX_TEST=true
 * - Demo testMode:        NEXT_PUBLIC_DEMO_MODE=true (or any non-production env unless
 *                     explicitly disabled with NEXT_PUBLIC_DEMO_MODE=false)
 */
export function isPrivateBetaMode(): boolean {
  if (process.env.PONTIS_SANDBOX_TEST === "true") return true;

  const flag = process.env.NEXT_PUBLIC_DEMO_MODE;
  return flag === "true" || (flag === undefined && process.env.NODE_ENV !== "production");
}

/** Whether the gated PontisGlobe sandbox test surface should be shown / allowed to run. */
export function isSandboxTestEnabled(): boolean {
  return isPontisConfigured() && isPrivateBetaMode();
}
