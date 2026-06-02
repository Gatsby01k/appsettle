import { requireSession } from "@/lib/auth";
import { API_ENDPOINTS } from "@/lib/treasury";
import { PageHeader } from "@/components/ops/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function MethodBadge({ method }: { method: "GET" | "POST" }) {
  return (
    <span
      className={cn(
        "inline-flex w-14 justify-center rounded-md px-2 py-0.5 text-xs font-semibold",
        method === "GET" ? "bg-sky-50 text-sky-700 ring-1 ring-sky-200" : "bg-teal-50 text-teal-700 ring-1 ring-teal-200",
      )}
    >
      {method}
    </span>
  );
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <pre className="overflow-x-auto rounded-lg border border-white/10 bg-[#07132b] p-3 text-xs leading-relaxed text-slate-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default async function ApiReferencePage() {
  await requireSession();

  return (
    <div className="space-y-6">
      <PageHeader
        title="API"
        description="Programmatic access to the same settlement, reconciliation and treasury primitives the console uses."
      />

      <Card>
        <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-950">Base URL</p>
            <p className="text-xs text-slate-500">All endpoints are scoped to your organization via a bearer API key.</p>
          </div>
          <code className="rounded-md bg-slate-100 px-3 py-1.5 text-xs text-slate-700">https://api.inrsettle.com</code>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {API_ENDPOINTS.map((endpoint) => (
          <Card key={`${endpoint.method}-${endpoint.path}`}>
            <CardContent className="space-y-4 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <MethodBadge method={endpoint.method} />
                <code className="text-sm font-medium text-slate-950">{endpoint.path}</code>
              </div>
              <p className="text-sm text-slate-600">{endpoint.description}</p>
              <div className="grid gap-3 lg:grid-cols-2">
                {endpoint.request ? <CodeBlock label="Request" code={endpoint.request} /> : null}
                <CodeBlock label="Response" code={endpoint.response} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
