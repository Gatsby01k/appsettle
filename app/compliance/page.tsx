import { marketingMetadata, StaticMarketingPage } from "@/components/marketing/static-marketing-page";

export const metadata = marketingMetadata("compliance.html", "/compliance");

export default function CompliancePage() {
  return <StaticMarketingPage fileName="compliance.html" />;
}
