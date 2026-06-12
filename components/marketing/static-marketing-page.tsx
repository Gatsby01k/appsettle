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

// Additive, scoped polish layer injected AFTER the base marketing stylesheet so
// these rules win where they overlap. Does not modify styles.css. Delivers a
// mobile-first refinement pass: zero horizontal overflow, a premium hamburger
// drawer, a rebuilt hero, a compacted preview console, a vertical workflow
// timeline, tidy stacked sections/footer, fluid typography, and iOS safe-area
// support — while preserving the institutional desktop direction.
const MARKETING_POLISH_CSS = `
/* ============================================================
   HERO CONSOLE MOTION — premium, restrained micro-animation.
   Additive only; the global prefers-reduced-motion rule in
   styles.css (animation:none!important) disables all of it.
   ============================================================ */
/* Soft pulse on the operational status dot */
.rail-meta .live-dot{animation:lpLiveDot 2.6s ease-in-out infinite}
@keyframes lpLiveDot{
  0%,100%{box-shadow:0 0 0 5px rgba(0,199,157,.12)}
  50%{box-shadow:0 0 0 9px rgba(0,199,157,.05)}
}
/* Sync flash: gentle header shimmer + sync label emphasis on each refresh */
.dash-top{position:relative}
.dash-top.sync-flash::after{content:"";position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(105deg,transparent 30%,rgba(0,199,157,.10) 50%,transparent 70%);
  background-size:220% 100%;animation:lpSyncSweep .85s ease-out both}
@keyframes lpSyncSweep{from{background-position:120% 0;opacity:1}to{background-position:-60% 0;opacity:0}}
.dash-top.sync-flash .sync-age{color:#0a7d6a;transition:color .25s ease}
.sync-age{transition:color .6s ease;font-variant-numeric:tabular-nums}

/* KPI cards: smooth staggered entrance on load */
.metric-grid .metric{animation:lpKpiIn .6s cubic-bezier(.2,.7,.2,1) both}
.metric-grid .metric:nth-child(2){animation-delay:.09s}
.metric-grid .metric:nth-child(3){animation-delay:.18s}
@keyframes lpKpiIn{from{opacity:0;transform:translateY(12px) scale(.985)}to{opacity:1;transform:none}}

/* Subtle connector/rail pulse between source and destination legs */
.flow-card::before{animation:lpRailGlow 4.2s ease-in-out infinite}
@keyframes lpRailGlow{0%,100%{opacity:.3}50%{opacity:.55}}

/* Confirmed / Reconciled pills: gentle first-load emphasis */
.settlement-list .pill{animation:lpPillIn .5s cubic-bezier(.2,.7,.2,1) both}
.settlement-list .settlement-row:nth-child(2) .pill{animation-delay:.1s}
.settlement-list .settlement-row:nth-child(3) .pill{animation-delay:.2s}
.settlement-list .settlement-row:nth-child(4) .pill{animation-delay:.3s}
@keyframes lpPillIn{from{opacity:0;transform:scale(.92)}60%{opacity:1;transform:scale(1.03)}to{opacity:1;transform:scale(1)}}

/* Section cards: soft hover lift + brand glow (cards already lift; add glow) */
.card:hover{border-color:rgba(0,199,157,.20);
  box-shadow:0 24px 54px rgba(7,17,31,.10),0 0 0 1px rgba(0,199,157,.08)}
.stat{transition:transform .22s var(--ease),box-shadow .22s var(--ease)}
.stat:hover{transform:translateY(-2px);box-shadow:0 18px 44px rgba(7,17,31,.10)}
.trust-card{transition:transform .22s var(--ease),box-shadow .22s var(--ease),border-color .22s var(--ease)}
.trust-card:hover{transform:translateY(-2px);border-color:rgba(0,199,157,.16)}

/* ============================================================
   API SECTION — composition fix + motion.
   Root cause of the overlap: .code-panel pre{min-width:420px}
   plus a cramped 2-col endpoint grid with nowrap content. The
   endpoints become a single-column rail; nothing can overlap.
   ============================================================ */
.split--api{grid-template-columns:minmax(0,.92fr) minmax(0,1.08fr);gap:40px;align-items:start}
.split--api>*{min-width:0}
.split--api .endpoint-grid{grid-template-columns:1fr;gap:12px}
.endpoint{min-width:0;position:relative;transition:transform .2s var(--ease),box-shadow .2s var(--ease),border-color .2s var(--ease)}
.endpoint code{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.endpoint .ep-desc{flex-shrink:0}
.endpoint:hover{transform:translateY(-2px);border-color:rgba(11,180,196,.30)}
/* Selected endpoint (POST /v1/settlements): clear active border + soft glow */
.endpoint.active{border-color:rgba(11,180,196,.55);
  box-shadow:0 16px 38px rgba(7,17,31,.26),0 0 0 1px rgba(11,180,196,.30),0 0 26px rgba(11,180,196,.16)}
.endpoint.active::before{content:"";position:absolute;left:0;top:14px;bottom:14px;width:3px;
  border-radius:999px;background:linear-gradient(180deg,#0bb4c4,#00c79d)}
.endpoint.active code{color:#aef3f8}

/* Code panel: premium but bounded — never forces overflow */
.code-panel{min-width:0;max-width:100%;position:relative}
.code-panel pre{min-width:0;overflow-x:auto}
.code-top{display:flex;align-items:center;gap:12px;padding:13px 18px;
  border-bottom:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03)}
.code-dots{display:flex;gap:7px}
.code-dots i{width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,.16)}
.code-dots i:nth-child(3){background:rgba(0,199,157,.7)}
.code-title{font:800 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em;
  text-transform:uppercase;color:#7e93a8}
.code-status{margin-left:auto;display:inline-flex;align-items:center;gap:7px;padding:5px 11px;
  border-radius:999px;border:1px solid rgba(0,199,157,.30);background:rgba(0,199,157,.10);
  color:#7df0d4;font:800 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;opacity:0}
.code-status::before{content:"";width:6px;height:6px;border-radius:50%;background:#00c79d;
  box-shadow:0 0 10px rgba(0,199,157,.8)}
/* request -> response feeling: the status chip fades in after the panel reveals */
.code-panel.revealed .code-status{animation:lpCodeStatus .5s var(--ease) .9s both}
@keyframes lpCodeStatus{from{opacity:0;transform:translateX(6px)}to{opacity:1;transform:none}}
.code-panel.revealed pre{animation:lpCodeReveal .7s var(--ease) .15s both}
@keyframes lpCodeReveal{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}

/* Tablet/mobile: stack cleanly with comfortable spacing */
@media (max-width:980px){
  .split--api{grid-template-columns:1fr;gap:24px}
  .split--api .endpoint-grid{grid-template-columns:1fr 1fr}
}
@media (max-width:680px){
  .split--api .endpoint-grid{grid-template-columns:1fr}
}

/* ============================================================
   SIGNATURE BACKGROUND — settlement rails / proof flow.
   Orbs travel the same SVG rail paths via CSS offset-path; the
   dashed rails drift slowly. All of it dies under the global
   prefers-reduced-motion rule (animation:none!important).
   ============================================================ */
.mkt-bg-orbs{position:absolute;top:-40px;left:50%;transform:translateX(-50%);
  width:1680px;max-width:none;height:820px;pointer-events:none}
.mkt-orb{position:absolute;top:0;left:0;width:7px;height:7px;border-radius:50%;opacity:0;
  offset-rotate:0deg;will-change:offset-distance}
.mkt-orb-a{background:#0bb4c4;box-shadow:0 0 16px rgba(11,180,196,.65),0 0 36px rgba(11,180,196,.25);
  offset-path:path("M-60,250 C 340,90 660,330 1010,200 S 1500,140 1740,300");
  animation:lpOrbTravel 36s linear infinite}
.mkt-orb-b{width:6px;height:6px;background:#f2ad23;box-shadow:0 0 14px rgba(242,173,35,.55),0 0 30px rgba(242,173,35,.2);
  offset-path:path("M-60,460 C 320,560 700,330 1060,480 S 1520,560 1740,420");
  animation:lpOrbTravel 44s linear infinite;animation-delay:-18s}
.mkt-orb-c{width:5px;height:5px;background:#0bb4c4;box-shadow:0 0 12px rgba(11,180,196,.5);
  offset-path:path("M-60,150 C 380,300 720,70 1070,250 S 1540,330 1740,170");
  animation:lpOrbTravel 52s linear infinite;animation-delay:-30s}
@keyframes lpOrbTravel{
  0%{offset-distance:0%;opacity:0}
  6%{opacity:.85}
  94%{opacity:.85}
  100%{offset-distance:100%;opacity:0}
}
.mkt-rail-dash{animation:lpRailDrift 60s linear infinite}
.mkt-rail-dash--slow{animation-duration:90s;animation-direction:reverse}
@keyframes lpRailDrift{to{stroke-dashoffset:-220}}
/* keep the background cheap on small screens */
@media (max-width:760px){.mkt-bg-orbs{display:none}.mkt-rail-dash{animation:none}}

/* ---- Desktop / base polish ---- */
.nav-actions{display:flex;align-items:center;gap:8px}
.nav-actions .btn{white-space:nowrap}
.nav-actions .btn.primary{box-shadow:0 10px 26px rgba(7,19,43,.14)}
.hero-ctas{display:flex;flex-wrap:wrap;align-items:center;gap:14px}
.hero-ctas .btn{white-space:nowrap}
.hero-ctas .btn.primary{box-shadow:0 14px 34px rgba(7,19,43,.18)}
.site-header .nav{gap:18px}
.intent-card{display:flex;flex-direction:column}
.intent-card .feature-list{flex:1}
.intent-card .intent-cta{margin-top:26px}
.intent-card .intent-cta .btn{width:auto}

/* ============================================================
   GLOBAL — eliminate horizontal overflow + safe-area scaffolding
   (overflow-x:clip avoids the position:sticky breakage that
   overflow-x:hidden causes, and is supported on iOS Safari 16+.)
   ============================================================ */
html{overflow-x:clip;-webkit-text-size-adjust:100%}
body{overflow-x:clip;max-width:100%}
main{overflow-x:clip}
/* allow flex/grid children holding long content to shrink instead of pushing width */
.nav>*,.hero-grid>*,.feature-split>*,.split>*,.section-head>*,.flow-line>*,
.settlement-row>*,.execution-strip>*,.rail-footer>*,.proof-item>*,.recon-row>*,
.assurance-strip>*,.corridor-signature>*{min-width:0}
h1,h2,h3,.lead,p,code{overflow-wrap:break-word}

/* honor notch / safe areas for the centered container on small screens */
@media (max-width:1100px){
  .container{
    width:min(100% - 28px,1280px);
    padding-left:env(safe-area-inset-left);
    padding-right:env(safe-area-inset-right);
  }
}

/* ============================================================
   HEADER / NAV — premium hamburger + drawer
   ============================================================ */
.site-header{padding-top:env(safe-area-inset-top)}
.menu-btn{align-items:center;justify-content:center;width:46px;height:46px;padding:0;
  border-radius:14px;border:1px solid rgba(7,17,31,.12);background:rgba(255,255,255,.92);
  box-shadow:0 8px 20px rgba(7,17,31,.06);color:var(--ink)}
.menu-btn svg{width:22px;height:22px;display:block;stroke:currentColor;stroke-width:2;
  stroke-linecap:round;stroke-linejoin:round;fill:none}
.menu-btn .menu-icon-close{display:none}
.menu-btn[aria-expanded="true"] .menu-icon-open{display:none}
.menu-btn[aria-expanded="true"] .menu-icon-close{display:block}

@media (max-width:1100px){
  .nav{height:64px;gap:14px}
  /* the desktop pill nav + action buttons live in the drawer on mobile */
  .nav-links,.nav-actions{display:none}
  .menu-btn{display:inline-flex}
  .mobile-panel{display:none}
  .mobile-panel.open{
    display:block;position:absolute;
    left:max(14px,env(safe-area-inset-left));
    right:max(14px,env(safe-area-inset-right));
    top:calc(100% + 8px);
    background:rgba(255,255,255,.97);backdrop-filter:blur(22px);
    border:1px solid rgba(7,17,31,.1);border-radius:22px;padding:14px;
    box-shadow:0 30px 70px rgba(7,17,31,.18);
    max-height:calc(100dvh - 86px);overflow-y:auto;
    animation:mpanelIn .26s var(--ease) both;
  }
  @keyframes mpanelIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
  .mobile-panel-label{margin:2px 6px 8px;font-size:11px;font-weight:800;letter-spacing:.08em;
    text-transform:uppercase;color:#8492a5}
  .mobile-panel a:not(.btn){display:block;padding:13px 14px;border-radius:13px;font-weight:650;
    color:#3c4b5e;font-size:15px}
  .mobile-panel a:not(.btn):hover{background:rgba(11,180,196,.08);color:var(--ink)}
  .mobile-panel a[href="/login"]{font-weight:750;color:var(--ink)}
  .mobile-panel-actions{display:grid;gap:10px;margin-top:12px;padding-top:14px;
    border-top:1px solid rgba(7,17,31,.08)}
  .mobile-panel-actions .btn{width:100%;min-height:50px}
}

/* ============================================================
   HERO — rebuilt for mobile
   ============================================================ */
@media (max-width:760px){
  .hero-grid{padding:28px 0 44px;gap:30px}
  h1{font-size:clamp(30px,8.2vw,42px);line-height:1.08;letter-spacing:-.02em;text-wrap:balance}
  .lead{font-size:clamp(16px,4.3vw,18px);line-height:1.5;margin-top:18px;max-width:560px;text-wrap:pretty}
  .eyebrow{margin-bottom:14px}
  .hero-ctas{flex-direction:column;align-items:stretch;gap:12px;width:100%;max-width:420px;margin-top:24px}
  .hero-ctas .btn{width:100%;flex:none}
  .hero-proof{margin-top:20px;padding:12px 14px}
  .trust-row{gap:10px;margin-top:20px}
  .trust-card{min-height:0;padding:16px}
  .trust-card strong{font-size:24px}
}

/* ============================================================
   PREVIEW CONSOLE (live rail) — compacted for mobile
   ============================================================ */
@media (max-width:760px){
  .dashboard{border-radius:24px}
  .dash-top{height:50px;padding:0 14px}
  .rail-meta{font-size:12px;gap:8px}
  .sync-age{display:none}
  .dash-body{padding:14px}
  .assurance-strip{grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}
  .assurance-strip span{height:34px;font-size:11px}
  .metric-grid{grid-template-columns:repeat(3,1fr);gap:8px}
  .metric{height:auto;min-height:80px;padding:13px 12px}
  .metric span{font-size:11.5px}
  .metric strong{font-size:clamp(18px,5.6vw,24px);margin-top:6px;letter-spacing:-.04em}
  .metric em{margin-top:7px;font-size:11.5px}
  .flow-card{padding:14px;border-radius:20px;margin-top:14px}
  .risk-ledger{height:auto;min-height:46px;padding:10px 14px;flex-wrap:wrap;gap:2px 12px}
  .risk-ledger strong{font-size:14px;max-width:100%}
  .currency{height:auto;min-height:92px;padding:16px}
  .currency strong{font-size:22px}
  .execution-strip{grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
  .execution-strip span:first-child{grid-column:1 / -1}
  .rail-footer{grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}
  .rail-footer>div{height:auto;min-height:62px;padding:11px 10px}
  .rail-footer strong{font-size:14px}
  .label{font-size:10px}
  .settlement-list{margin-top:12px;gap:8px}
  .settlement-row{grid-template-columns:minmax(0,1fr) auto;
    grid-template-areas:"title pill" "meta pill";
    height:auto;min-height:56px;gap:2px 10px;align-items:center;padding:11px 14px}
  .settlement-row>span:first-child{grid-area:title;font-size:13px}
  .settlement-row small{grid-area:meta;font-size:11px}
  .settlement-row .pill{grid-area:pill;align-self:center;justify-self:end}
  .ledger-note{margin-top:12px;padding:11px 12px;flex-wrap:wrap;gap:6px 10px}
}
@media (max-width:430px){
  .settlement-list .settlement-row:nth-child(n+4){display:none}
}

/* ============================================================
   WORKFLOW — vertical timeline on mobile
   ============================================================ */
@media (max-width:600px){
  .workflow-rail{grid-template-columns:1fr;gap:0;margin-top:6px}
  .workflow-rail::before{display:none}
  .wf-step{display:grid;grid-template-columns:54px 1fr;column-gap:16px;align-items:start;
    text-align:left;padding:0 0 24px;position:relative}
  .wf-step::after{content:"";position:absolute;left:26px;top:58px;bottom:-2px;width:2px;
    background:linear-gradient(180deg,rgba(11,180,196,.45),rgba(11,180,196,.22))}
  .wf-step:nth-child(n+5)::after{background:linear-gradient(180deg,rgba(242,173,35,.45),rgba(242,173,35,.22))}
  .wf-step:last-child::after{display:none}
  .wf-node{grid-row:1 / span 2;width:54px;height:54px;align-self:start}
  .wf-step b{align-self:center;font-size:15px}
  .wf-step span{font-size:13px;margin-top:2px}
}

/* developer split stacks before the iPad portrait width so the code
   panel gets full width instead of internal horizontal scroll */
@media (max-width:820px){
  .split{grid-template-columns:1fr;gap:28px}
}

/* ============================================================
   SECTIONS — cards / grids / stats / CTA
   ============================================================ */
@media (max-width:760px){
  .section,.section.alt{padding:52px 0}
  .section-head{margin-bottom:24px}
  .section-head p{font-size:16px}
  h2{font-size:clamp(25px,6.6vw,34px);line-height:1.14;text-wrap:balance}
  .card{min-height:0;padding:22px;border-radius:20px}
  .card h3{font-size:19px}
  .card p{font-size:15px}
  .grid-4{gap:14px}
  .proof-band{padding:24px 0 0}
  .feature-split{gap:24px}
  .feature-split .lead{font-size:16px;margin-top:14px}
  .panel{padding:16px;border-radius:22px}
  .tile-grid{gap:10px}
  .tile{padding:14px}
  .tile strong{font-size:20px}
  .stat-band{grid-template-columns:1fr 1fr;gap:12px}
  .stat{padding:20px;border-radius:20px}
  .stat strong{font-size:24px}
  .endpoint{padding:14px 16px}
  .code-panel pre{font-size:12.5px}
  .cta-band{padding:34px 22px;border-radius:24px}
  .cta-band h2{font-size:clamp(24px,6.4vw,32px)}
  .cta-band p{font-size:16px}
  .cta-band .hero-ctas{max-width:none}
}

/* ============================================================
   FOOTER — tidy stacked columns + bottom safe-area
   ============================================================ */
@media (max-width:760px){
  .footer{padding:44px 0 calc(36px + env(safe-area-inset-bottom))}
  .footer-grid{grid-template-columns:1fr 1fr;gap:26px 20px}
  .footer-grid>:first-child{grid-column:1 / -1}
  .footer h4{margin-bottom:12px}
  .footer a:not(.brand){margin:8px 0}
}
@media (max-width:380px){
  .footer-grid{grid-template-columns:1fr}
}
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

// Pages that own a bespoke closing CTA and must not receive the shared band.
const FINAL_CTA_EXCLUDED = new Set(["index.html", "contact.html"]);

const finalCtaBand = `
<section class="section">
  <div class="container">
    <div class="cta-band">
      <div class="cta-inner">
        <div class="eyebrow">Get started</div>
        <h2>Modernize Your India Settlement Stack</h2>
        <p>Bring INR ↔ USDT settlement, treasury visibility, and auto-reconciliation onto one corridor-native operating layer.</p>
        <div class="hero-ctas">
          <a class="btn primary" href="/contact?intent=access">Request Access</a>
          <a class="btn" href="/contact?intent=sales">Talk to Sales</a>
        </div>
      </div>
    </div>
  </div>
</section>`;

function injectFinalCta(html: string, fileName: string) {
  if (FINAL_CTA_EXCLUDED.has(fileName)) return html;
  return html.replace(/<footer/i, `${finalCtaBand}<footer`);
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
  const withFinalCta = injectFinalCta(withCtas, fileName);

  return applyContactIntent(withFinalCta, fileName, intent);
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

// Shared branded atmosphere rendered behind every public page: dotted global
// field, aqua/amber settlement-rail trails with glowing nodes, and soft glow.
function MarketingBackground() {
  return (
    <div className="mkt-bg" aria-hidden="true">
      <div className="mkt-bg-dots" />
      <svg
        className="mkt-bg-rails"
        viewBox="0 0 1680 820"
        fill="none"
        preserveAspectRatio="xMidYMin slice"
      >
        <defs>
          <linearGradient id="railA" x1="0" y1="0" x2="1680" y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0bb4c4" stopOpacity="0" />
            <stop offset="0.22" stopColor="#0bb4c4" stopOpacity="0.75" />
            <stop offset="0.68" stopColor="#f2ad23" stopOpacity="0.6" />
            <stop offset="1" stopColor="#f2ad23" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="railB" x1="0" y1="0" x2="1680" y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f2ad23" stopOpacity="0" />
            <stop offset="0.3" stopColor="#f2ad23" stopOpacity="0.5" />
            <stop offset="0.75" stopColor="#0bb4c4" stopOpacity="0.65" />
            <stop offset="1" stopColor="#0bb4c4" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="node" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#0bb4c4" stopOpacity="0.9" />
            <stop offset="1" stopColor="#0bb4c4" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nodeAmber" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#f2ad23" stopOpacity="0.9" />
            <stop offset="1" stopColor="#f2ad23" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path d="M-60,250 C 340,90 660,330 1010,200 S 1500,140 1740,300" stroke="url(#railA)" strokeWidth="2" />
        <path className="mkt-rail-dash" d="M-60,150 C 380,300 720,70 1070,250 S 1540,330 1740,170" stroke="url(#railB)" strokeWidth="1.6" strokeDasharray="2 9" />
        <path d="M-60,460 C 320,560 700,330 1060,480 S 1520,560 1740,420" stroke="url(#railA)" strokeWidth="1.6" />
        <path className="mkt-rail-dash mkt-rail-dash--slow" d="M-60,360 C 420,200 780,520 1140,360 S 1560,250 1740,420" stroke="url(#railB)" strokeWidth="1.2" strokeDasharray="2 10" />
        <g>
          <circle cx="320" cy="150" r="26" fill="url(#node)" />
          <circle cx="320" cy="150" r="3.2" fill="#0bb4c4" />
          <circle cx="1010" cy="200" r="30" fill="url(#nodeAmber)" />
          <circle cx="1010" cy="200" r="3.4" fill="#f2ad23" />
          <circle cx="700" cy="330" r="24" fill="url(#node)" />
          <circle cx="700" cy="330" r="3" fill="#0bb4c4" />
          <circle cx="1400" cy="250" r="22" fill="url(#nodeAmber)" />
          <circle cx="1400" cy="250" r="3" fill="#f2ad23" />
        </g>
      </svg>
      {/* Proof-flow orbs: soft pulses travelling along the rails (CSS offset-path,
          so the global prefers-reduced-motion rule disables them entirely). */}
      <div className="mkt-bg-orbs" aria-hidden="true">
        <span className="mkt-orb mkt-orb-a" />
        <span className="mkt-orb mkt-orb-b" />
        <span className="mkt-orb mkt-orb-c" />
      </div>
      <div className="mkt-bg-glow" />
    </div>
  );
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
      <MarketingBackground />
      <div dangerouslySetInnerHTML={{ __html: html }} />
      {analytics ? <Script id="inrsettle-marketing-analytics" strategy="afterInteractive">{analytics}</Script> : null}
      {script ? <Script id={`inrsettle-marketing-${fileName}`} strategy="afterInteractive">{script}</Script> : null}
    </>
  );
}
