import { marketingMetadata, StaticMarketingPage } from "@/components/marketing/static-marketing-page";

export const metadata = marketingMetadata("index.html", "/");

export default function HomePage() {
  return <StaticMarketingPage fileName="index.html" />;
}
