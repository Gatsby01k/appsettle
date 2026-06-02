import { marketingMetadata, StaticMarketingPage } from "@/components/marketing/static-marketing-page";

export const metadata = marketingMetadata("contact.html", "/contact");

export default function ContactPage() {
  return <StaticMarketingPage fileName="contact.html" />;
}
