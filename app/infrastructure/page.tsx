import { marketingMetadata, StaticMarketingPage } from "@/components/marketing/static-marketing-page";

export const metadata = marketingMetadata("infrastructure.html", "/infrastructure");

export default function InfrastructurePage() {
  return <StaticMarketingPage fileName="infrastructure.html" />;
}
