import { marketingMetadata, StaticMarketingPage } from "@/components/marketing/static-marketing-page";

export const metadata = marketingMetadata("security.html", "/security");

export default function SecurityPage() {
  return <StaticMarketingPage fileName="security.html" />;
}
