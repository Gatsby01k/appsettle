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

// Additive, scoped polish layer injected after the base marketing stylesheet.
// Does not modify styles.css. Fixes nav/CTA spacing, prevents the Sign in button
// from wrapping, tightens hero/footer balance and improves small-screen behavior.
const MARKETING_POLISH_CSS = `
.nav-actions{display:flex;align-items:center;gap:12px}
.nav-actions .btn{white-space:nowrap}
.nav-actions .btn.primary{box-shadow:0 10px 26px rgba(7,19,43,.14)}
.hero-ctas{display:flex;flex-wrap:wrap;align-items:center;gap:14px}
.hero-ctas .btn{white-space:nowrap}
.hero-ctas .btn.primary{box-shadow:0 14px 34px rgba(7,19,43,.18)}
.site-header .nav{gap:18px}
@media (max-width:860px){
  .nav-actions{gap:8px}
}
@media (max-width:640px){
  .hero-ctas{width:100%}
  .hero-ctas .btn{flex:1 1 160px;justify-content:center}
  .footer-grid{gap:24px}
}
.intent-card{display:flex;flex-direction:column}
.intent-card .feature-list{flex:1}
.intent-card .intent-cta{margin-top:26px}
.intent-card .intent-cta .btn{width:auto}
`;

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

function addConsoleNavigation(html: string) {
  return html
    .replace(
      /<div class="nav-actions">/,
      '<div class="nav-actions"><a class="btn" href="/login">Sign in</a>',
    )
    .replace(
      /(<div class="mobile-panel" id="mobile-navigation" data-mobile>[\s\S]*?<a href="\/contact">Contact<\/a>)/,
      '$1<a href="/login">Sign in</a>',
    );
}

function addHomepageConsoleCtas(html: string, fileName: string) {
  if (fileName !== "index.html") return html;

  return html.replace(
    /<div class="hero-ctas">[\s\S]*?<\/div><div class="hero-proof"/,
    '<div class="hero-ctas">' +
      '<a class="btn primary" href="/contact?intent=access">Request Access</a>' +
      '<a class="btn" href="/contact?intent=sales">Talk to Sales</a>' +
      '<a class="btn" href="/login">Launch console</a>' +
      '</div><div class="hero-proof"',
  );
}

// Separates the two public CTAs by intent. "Request Access" routes to the
// product/demo access flow, "Talk to Sales"/"Contact" routes to the sales
// conversation flow. Runs after console navigation so the nav/footer markup
// still matches the original anchors when those passes run.
function rewriteContactCtas(html: string) {
  return html
    .replace(/href="\/contact#access"/g, 'href="/contact?intent=access"')
    .replace(/href="\/contact"/g, 'href="/contact?intent=sales"');
}

type ContactIntent = "access" | "sales" | "default";

export function resolveContactIntent(value?: string | string[]): ContactIntent {
  const intent = Array.isArray(value) ? value[0] : value;
  if (intent === "access") return "access";
  if (intent === "sales") return "sales";
  return "default";
}

const directContactHtml = `
      <div class="direct-contact">
        <p>Prefer direct communication?</p>
        <p>Telegram: <a href="https://t.me/INRSettle_team" target="_blank" rel="noopener">@INRSettle_team</a></p>
        <p>Email: <a href="mailto:info@inrsettle.com">info@inrsettle.com</a></p>
      </div>`;

function accessMainHtml() {
  return `<main>
<section class="page-hero">
  <div class="container">
    <div class="eyebrow">Request access</div>
    <h1>Request access</h1>
    <p>Get access to the INRSettle demo console for treasury and settlement operations.</p>
  </div>
</section>
<section class="section" id="access">
  <div class="container split">
    <div class="contact-box">
      <h2>Product access</h2>
      <p class="muted">Share your business profile and settlement use case. The team reviews fit, KYB requirements, and operational needs before provisioning demo console access.</p>
      <ul class="feature-list">
        <li>Demo console for treasury and settlement</li>
        <li>India corridor settlement workflows</li>
        <li>INR ↔ USDT treasury operations</li>
        <li>API and dashboard access</li>
      </ul>${directContactHtml}
    </div>
    <form class="form card" name="access-request" method="POST" data-netlify="true" netlify-honeypot="bot-field">
      <input type="hidden" name="form-name" value="access-request">
      <input type="hidden" name="intent" value="Access request">
      <p hidden><label>Do not fill:<input name="bot-field"></label></p>
      <input name="email" type="email" placeholder="Work email" required>
      <input name="company" placeholder="Company" required>
      <input name="role" placeholder="Role">
      <select name="monthly_volume">
        <option value="">Monthly INR/USDT settlement volume</option>
        <option>Below $10k</option>
        <option>$10k–$50k</option>
        <option>$50k–$250k</option>
        <option>$250k+</option>
      </select>
      <textarea name="use_case" placeholder="Use case"></textarea>
      <button class="btn primary" type="submit">Request access</button>
    </form>
  </div>
</section>
</main>`;
}

function salesMainHtml() {
  return `<main>
<section class="page-hero">
  <div class="container">
    <div class="eyebrow">Talk to sales</div>
    <h1>Talk to sales</h1>
    <p>Discuss corridors, integration, settlement volume, and partnership requirements.</p>
  </div>
</section>
<section class="section" id="sales">
  <div class="container split">
    <div class="contact-box">
      <h2>Enterprise &amp; partnerships</h2>
      <p class="muted">Work with our team on corridor coverage, integration scope, settlement volume, and commercial terms for high-volume payment operations.</p>
      <ul class="feature-list">
        <li>Corridor and integration scoping</li>
        <li>Volume-based commercial terms</li>
        <li>Partnership and onboarding support</li>
        <li>Institutional KYB and risk review</li>
      </ul>${directContactHtml}
    </div>
    <form class="form card" name="sales-conversation" method="POST" data-netlify="true" netlify-honeypot="bot-field">
      <input type="hidden" name="form-name" value="sales-conversation">
      <input type="hidden" name="intent" value="Sales conversation">
      <p hidden><label>Do not fill:<input name="bot-field"></label></p>
      <input name="email" type="email" placeholder="Work email" required>
      <input name="company" placeholder="Company" required>
      <input name="role" placeholder="Role">
      <input name="corridor" placeholder="Corridor interest">
      <textarea name="message" placeholder="Message"></textarea>
      <button class="btn primary" type="submit">Talk to sales</button>
    </form>
  </div>
</section>
</main>`;
}

function defaultContactMainHtml() {
  return `<main>
<section class="page-hero">
  <div class="container">
    <div class="eyebrow">Contact</div>
    <h1>Contact INRSettle</h1>
    <p>Tell us how you'd like to engage. Request product access to the demo console, or start an enterprise and partnership conversation with our team.</p>
  </div>
</section>
<section class="section">
  <div class="container grid-2">
    <div class="contact-box intent-card">
      <div class="eyebrow">Product access</div>
      <h2>Request access</h2>
      <p class="muted">Get access to the INRSettle demo console for treasury and settlement operations. Best for teams evaluating the product directly.</p>
      <ul class="feature-list">
        <li>Demo console access</li>
        <li>INR ↔ USDT treasury workflows</li>
        <li>API and dashboard walkthrough</li>
      </ul>
      <p class="intent-cta"><a class="btn primary" href="/contact?intent=access">Request access</a></p>
    </div>
    <div class="contact-box intent-card">
      <div class="eyebrow">Enterprise &amp; partnerships</div>
      <h2>Talk to sales</h2>
      <p class="muted">Discuss corridors, integration, settlement volume, and partnership requirements with our team.</p>
      <ul class="feature-list">
        <li>Corridor and integration scoping</li>
        <li>Volume-based commercial terms</li>
        <li>Partnership and onboarding support</li>
      </ul>
      <p class="intent-cta"><a class="btn" href="/contact?intent=sales">Talk to sales</a></p>
    </div>
  </div>
</section>
</main>`;
}

function applyContactIntent(html: string, fileName: string, intent: ContactIntent) {
  if (fileName !== "contact.html") return html;

  const main =
    intent === "access" ? accessMainHtml() : intent === "sales" ? salesMainHtml() : defaultContactMainHtml();

  return html.replace(/<main>[\s\S]*?<\/main>/i, main);
}

function bodyHtml(fileName: string, intent: ContactIntent = "default") {
  const html = readStaticFile(fileName);
  const body = matchContent(html, /<body[^>]*>([\s\S]*?)<\/body>/i);

  const rewritten = rewriteMarketingLinks(body)
    .replace(/<script[^>]+src=["']\/analytics\.js["'][^>]*><\/script>/gi, "")
    .replace(/<script[^>]+src=["']\/script\.js["'][^>]*><\/script>/gi, "");

  const withConsole = addHomepageConsoleCtas(addConsoleNavigation(rewritten), fileName);
  const withCtas = rewriteContactCtas(withConsole);

  return applyContactIntent(withCtas, fileName, intent);
}

const contactIntentMeta: Record<Exclude<ContactIntent, "default">, { title: string; description: string }> = {
  access: {
    title: "Request access — INRSettle",
    description: "Get access to the INRSettle demo console for treasury and settlement operations.",
  },
  sales: {
    title: "Talk to sales — INRSettle",
    description: "Discuss corridors, integration, settlement volume, and partnership requirements.",
  },
};

export function marketingMetadata(fileName: string, routePath: string, intent: ContactIntent = "default"): Metadata {
  const html = readStaticFile(fileName);
  const fileTitle = matchContent(html, /<title>([\s\S]*?)<\/title>/i);
  const fileDescription = matchContent(html, /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  const intentMeta = fileName === "contact.html" && intent !== "default" ? contactIntentMeta[intent] : undefined;
  const title = intentMeta?.title ?? fileTitle;
  const description = intentMeta?.description ?? fileDescription;
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

export function StaticMarketingPage({ fileName, intent = "default" }: { fileName: string; intent?: ContactIntent }) {
  const css = fs.readFileSync(CSS_PATH, "utf8");
  const script = fs.existsSync(SCRIPT_PATH) ? fs.readFileSync(SCRIPT_PATH, "utf8") : "";
  const analytics = fs.existsSync(ANALYTICS_PATH) ? fs.readFileSync(ANALYTICS_PATH, "utf8") : "";
  const html = bodyHtml(fileName, intent);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <style dangerouslySetInnerHTML={{ __html: MARKETING_POLISH_CSS }} />
      <div dangerouslySetInnerHTML={{ __html: html }} />
      {analytics ? <Script id="inrsettle-marketing-analytics" strategy="afterInteractive">{analytics}</Script> : null}
      {script ? <Script id={`inrsettle-marketing-${fileName}`} strategy="afterInteractive">{script}</Script> : null}
    </>
  );
}
