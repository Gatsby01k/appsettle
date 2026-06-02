import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Script from "next/script";

const CSS_PATH = path.join(process.cwd(), "styles.css");
const SCRIPT_PATH = path.join(process.cwd(), "script.js");
const ANALYTICS_PATH = path.join(process.cwd(), "analytics.js");

const staticFiles: Record<string, string> = {
  "index.html": path.join(process.cwd(), "index.html"),
  "use-cases.html": path.join(process.cwd(), "use-cases.html"),
  "inr-settlement-india.html": path.join(process.cwd(), "inr-settlement-india.html"),
  "infrastructure.html": path.join(process.cwd(), "infrastructure.html"),
  "api.html": path.join(process.cwd(), "api.html"),
  "compliance.html": path.join(process.cwd(), "compliance.html"),
  "security.html": path.join(process.cwd(), "security.html"),
  "risk.html": path.join(process.cwd(), "risk.html"),
  "status.html": path.join(process.cwd(), "status.html"),
  "contact.html": path.join(process.cwd(), "contact.html"),
  "docs/index.html": path.join(process.cwd(), "docs", "index.html"),
  "docs/api.html": path.join(process.cwd(), "docs", "api.html"),
  "docs/integration.html": path.join(process.cwd(), "docs", "integration.html"),
  "docs/webhooks.html": path.join(process.cwd(), "docs", "webhooks.html"),
  "docs/reconciliation.html": path.join(process.cwd(), "docs", "reconciliation.html"),
  "legal/privacy.html": path.join(process.cwd(), "legal", "privacy.html"),
  "legal/terms.html": path.join(process.cwd(), "legal", "terms.html"),
  "legal/compliance.html": path.join(process.cwd(), "legal", "compliance.html"),
};

const routeMap: Record<string, string> = {
  "/index.html": "/",
  "/docs/index.html": "/docs",
  "/docs/api.html": "/docs/api",
  "/docs/integration.html": "/docs/integration",
  "/docs/webhooks.html": "/docs/webhooks",
  "/docs/reconciliation.html": "/docs/reconciliation",
  "/legal/privacy.html": "/legal/privacy",
  "/legal/terms.html": "/legal/terms",
  "/legal/compliance.html": "/legal/compliance",
  "/use-cases.html": "/use-cases",
  "/inr-settlement-india.html": "/inr-settlement-india",
  "/infrastructure.html": "/infrastructure",
  "/api.html": "/developers",
  "/compliance.html": "/compliance",
  "/security.html": "/security",
  "/risk.html": "/risk",
  "/status.html": "/status",
  "/contact.html": "/contact",
};

function readStaticFile(fileName: string) {
  const filePath = staticFiles[fileName];
  if (!filePath) throw new Error(`Unknown marketing page: ${fileName}`);
  return fs.readFileSync(filePath, "utf8");
}

function matchContent(html: string, pattern: RegExp) {
  return html.match(pattern)?.[1] ?? "";
}

function rewriteMarketingLinks(html: string) {
  let rewritten = html;

  for (const [from, to] of Object.entries(routeMap)) {
    const escaped = from.replace(".", "\\.");
    rewritten = rewritten.replace(new RegExp(escaped, "g"), to);
  }

  return rewritten;
}

function bodyHtml(fileName: string) {
  const html = readStaticFile(fileName);
  const body = matchContent(html, /<body[^>]*>([\s\S]*?)<\/body>/i);

  return rewriteMarketingLinks(body)
    .replace(/<script[^>]+src=["']\/analytics\.js["'][^>]*><\/script>/gi, "")
    .replace(/<script[^>]+src=["']\/script\.js["'][^>]*><\/script>/gi, "");
}

export function marketingMetadata(fileName: string, routePath: string): Metadata {
  const html = readStaticFile(fileName);
  const title = matchContent(html, /<title>([\s\S]*?)<\/title>/i);
  const description = matchContent(html, /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  const ogTitle = matchContent(html, /<meta\s+property=["']og:title["']\s+content=["']([^"']*)["']/i) || title;
  const ogDescription =
    matchContent(html, /<meta\s+property=["']og:description["']\s+content=["']([^"']*)["']/i) || description;
  const twitterTitle = matchContent(html, /<meta\s+name=["']twitter:title["']\s+content=["']([^"']*)["']/i) || title;
  const twitterDescription =
    matchContent(html, /<meta\s+name=["']twitter:description["']\s+content=["']([^"']*)["']/i) || description;
  const canonical = `https://inrsettle.com${routePath}`;

  return {
    title,
    description,
    manifest: "/site.webmanifest",
    icons: {
      icon: "/assets/favicon.png",
      apple: "/assets/favicon.png",
    },
    alternates: { canonical },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      type: "website",
      url: canonical,
      images: ["/assets/logo.png"],
    },
    twitter: {
      card: "summary_large_image",
      title: twitterTitle,
      description: twitterDescription,
      images: ["/assets/logo.png"],
    },
  };
}

export function StaticMarketingPage({ fileName }: { fileName: string }) {
  const css = fs.readFileSync(CSS_PATH, "utf8");
  const script = fs.existsSync(SCRIPT_PATH) ? fs.readFileSync(SCRIPT_PATH, "utf8") : "";
  const analytics = fs.existsSync(ANALYTICS_PATH) ? fs.readFileSync(ANALYTICS_PATH, "utf8") : "";
  const html = bodyHtml(fileName);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div dangerouslySetInnerHTML={{ __html: html }} />
      {analytics ? <Script id="inrsettle-marketing-analytics" strategy="afterInteractive">{analytics}</Script> : null}
      {script ? <Script id={`inrsettle-marketing-${fileName}`} strategy="afterInteractive">{script}</Script> : null}
    </>
  );
}
