import type { MetadataRoute } from "next";

const routes = [
  { path: "/", priority: 1 },
  { path: "/infrastructure", priority: 0.9 },
  { path: "/developers", priority: 0.9 },
  { path: "/use-cases", priority: 0.8 },
  { path: "/security", priority: 0.8 },
  { path: "/compliance", priority: 0.8 },
  { path: "/docs", priority: 0.7 },
  { path: "/docs/api", priority: 0.7 },
  { path: "/docs/integration", priority: 0.7 },
  { path: "/docs/webhooks", priority: 0.7 },
  { path: "/docs/reconciliation", priority: 0.7 },
  { path: "/contact", priority: 0.9 },
  { path: "/risk", priority: 0.6 },
  { path: "/status", priority: 0.6 },
  { path: "/legal/privacy", priority: 0.5 },
  { path: "/legal/terms", priority: 0.5 },
  { path: "/legal/compliance", priority: 0.5 },
  { path: "/inr-settlement-india", priority: 0.8 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-06-01");

  return routes.map((route) => ({
    url: `https://inrsettle.com${route.path}`,
    lastModified,
    priority: route.priority,
  }));
}
