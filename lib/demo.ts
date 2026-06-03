export type DemoCredentials = {
  email: string;
  password: string;
};

/**
 * Demo credentials are only surfaced when demo mode is explicitly enabled.
 *
 * - In production, the demo block is hidden unless `NEXT_PUBLIC_DEMO_MODE=true`.
 * - Outside production it stays on by default for local/staging walkthroughs,
 *   unless explicitly disabled with `NEXT_PUBLIC_DEMO_MODE=false`.
 *
 * The credentials themselves can be overridden via env so nothing sensitive is
 * hardcoded into a public production build.
 */
export function getDemoCredentials(): DemoCredentials | null {
  const flag = process.env.NEXT_PUBLIC_DEMO_MODE;
  const enabled = flag === "true" || (flag === undefined && process.env.NODE_ENV !== "production");

  if (!enabled) return null;

  return {
    email: process.env.NEXT_PUBLIC_DEMO_EMAIL ?? "ops@inrsettle.com",
    password: process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? "ChangeMe123!",
  };
}
