import { RailLoader, SkeletonListPanel } from "@/components/ui/settlement-rail-loader";
import { Skeleton } from "@/components/ui/skeleton";

export default function AuditLogsLoading() {
  return (
    <div className="space-y-4">
      <div className="conf-hero flex flex-wrap items-center justify-between gap-5 p-5 sm:p-6">
        <div className="space-y-2.5">
          <Skeleton className="h-5 w-44 rounded-full" />
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <RailLoader label="Loading evidence trail" className="hidden md:block" />
      </div>
      <SkeletonListPanel rows={8} />
    </div>
  );
}
