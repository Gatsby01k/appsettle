import { marketingMetadata, StaticMarketingPage } from "@/components/marketing/static-marketing-page";

export const metadata = marketingMetadata("use-cases.html", "/use-cases");

export default function UseCasesPage() {
  return <StaticMarketingPage fileName="use-cases.html" />;
}
