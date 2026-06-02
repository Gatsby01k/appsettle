import Link from "next/link";
import { Button } from "@/components/ui/button";

const items = [
  { href: "/quotes", label: "Create quote" },
  { href: "/settlements", label: "Create settlement" },
  { href: "/reconciliation", label: "Add reconciliation" },
  { href: "/audit-logs", label: "Audit trail" },
];

export function QuickActions() {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, index) => (
        <Button key={item.href} asChild variant={index === 0 ? "primary" : "outline"} size="sm">
          <Link href={item.href}>{item.label}</Link>
        </Button>
      ))}
    </div>
  );
}
