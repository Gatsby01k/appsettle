import { marketingMetadata, StaticMarketingPage } from "@/components/marketing/static-marketing-page";

export const metadata = marketingMetadata("api.html", "/developers");

export default function DevelopersPage() {
  return <StaticMarketingPage fileName="api.html" />;
}
