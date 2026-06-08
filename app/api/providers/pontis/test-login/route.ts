import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { isPontisConfigured, login } from "@/lib/providers/pontis/client";

export const runtime = "nodejs";

/**
 * POST /api/providers/pontis/test-login
 *
 * Dev-only connectivity check. Logs in with the configured credentials and
 * confirms a JWT was issued WITHOUT returning the token itself (only a short,
 * masked preview + expiry). Never logs or echoes full secrets.
 */
export async function POST() {
  const gate = devOnlyGuard();
  if (gate) return gate;

  if (!isPontisConfigured()) {
    return NextResponse.json({ error: "PontisGlobe is not configured." }, { status: 503 });
  }

  try {
    const { token, response } = await login();

    const envelope = response.data as { token_type?: string; data?: { token_type?: string; expires_in?: number } } | null;
    const tokenType = envelope?.data?.token_type ?? envelope?.token_type ?? null;
    const expiresIn = envelope?.data?.expires_in ?? null;

    return NextResponse.json({
      ok: response.ok && Boolean(token),
      status: response.status,
      authenticated: Boolean(token),
      tokenPreview: token ? `${token.slice(0, 6)}…${token.slice(-4)}` : null,
      tokenType,
      expiresIn,
    });
  } catch (err) {
    return jsonError(err);
  }
}

/**
 * Test routes are gated to non-production environments. Allow an explicit opt-in
 * via PONTIS_SANDBOX_TEST=true for sandbox verification in hosted preview envs.
 */
function devOnlyGuard(): NextResponse | null {
  const enabled =
    process.env.NODE_ENV !== "production" || process.env.PONTIS_SANDBOX_TEST === "true";
  if (!enabled) {
    return NextResponse.json(
      { error: "PontisGlobe test routes are disabled in this environment." },
      { status: 403 },
    );
  }
  return null;
}
