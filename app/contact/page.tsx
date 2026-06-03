import type { Metadata } from "next";
import {
  marketingMetadata,
  resolveContactIntent,
  StaticMarketingPage,
} from "@/components/marketing/static-marketing-page";

type ContactSearchParams = { intent?: string | string[] };

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<ContactSearchParams>;
}): Promise<Metadata> {
  const { intent } = await searchParams;
  return marketingMetadata("contact.html", "/contact", resolveContactIntent(intent));
}

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<ContactSearchParams>;
}) {
  const { intent } = await searchParams;
  return <StaticMarketingPage fileName="contact.html" intent={resolveContactIntent(intent)} />;
}
