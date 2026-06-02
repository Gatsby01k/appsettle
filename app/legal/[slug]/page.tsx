import { notFound } from "next/navigation";
import { marketingMetadata, StaticMarketingPage } from "@/components/marketing/static-marketing-page";

const legalPages: Record<string, { fileName: string; routePath: string }> = {
  privacy: { fileName: "legal/privacy.html", routePath: "/legal/privacy" },
  terms: { fileName: "legal/terms.html", routePath: "/legal/terms" },
  compliance: { fileName: "legal/compliance.html", routePath: "/legal/compliance" },
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const page = legalPages[(await params).slug];
  if (!page) return {};
  return marketingMetadata(page.fileName, page.routePath);
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const page = legalPages[(await params).slug];
  if (!page) notFound();

  return <StaticMarketingPage fileName={page.fileName} />;
}
