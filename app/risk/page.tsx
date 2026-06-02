import { marketingMetadata, StaticMarketingPage } from "@/components/marketing/static-marketing-page";

export const metadata = marketingMetadata("risk.html", "/risk");

export default function RiskPage() {
  return <StaticMarketingPage fileName="risk.html" />;
}
