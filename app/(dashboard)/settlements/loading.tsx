import { RailLoader, SkeletonCaseCard } from "@/components/ui/settlement-rail-loader";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettlementsLoading() {
  return (
    <div className="space-y-4">
      {/* Hero band placeholder */}
      <div className="conf-hero flex flex-wrap items-center justify-between gap-5 p-5 sm:p-6">
        <div className="space-y-2.5">
          <Skeleton className="h-5 w-36 rounded-full" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <RailLoader label="Loading settlement cases" className="hidden md:block" />
      </div>
      {/* Case card skeletons matching the real layout (no layout shift) */}
      <div className="space-y-3">
        <SkeletonCaseCard />
        <SkeletonCaseCard />
        <SkeletonCaseCard />
      </div>
    </div>
  );
}
