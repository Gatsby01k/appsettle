import { marketingMetadata, StaticMarketingPage } from "@/components/marketing/static-marketing-page";

export const metadata = marketingMetadata("status.html", "/status");

export default function StatusPage() {
  return <StaticMarketingPage fileName="status.html" />;
}
