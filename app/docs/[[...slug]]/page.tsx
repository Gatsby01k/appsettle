import { notFound } from "next/navigation";
import { marketingMetadata, StaticMarketingPage } from "@/components/marketing/static-marketing-page";

const docsPages: Record<string, { fileName: string; routePath: string }> = {
  index: { fileName: "docs/index.html", routePath: "/docs" },
  api: { fileName: "docs/api.html", routePath: "/docs/api" },
  integration: { fileName: "docs/integration.html", routePath: "/docs/integration" },
  webhooks: { fileName: "docs/webhooks.html", routePath: "/docs/webhooks" },
  reconciliation: { fileName: "docs/reconciliation.html", routePath: "/docs/reconciliation" },
};

function resolveDocsPage(slug?: string[]) {
  const key = slug?.[0] ?? "index";
  return docsPages[key];
}

export async function generateMetadata({ params }: { params: Promise<{ slug?: string[] }> }) {
  const page = resolveDocsPage((await params).slug);
  if (!page) return {};
  return marketingMetadata(page.fileName, page.routePath);
}

export default async function DocsPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const page = resolveDocsPage((await params).slug);
  if (!page) notFound();

  return <StaticMarketingPage fileName={page.fileName} />;
}
