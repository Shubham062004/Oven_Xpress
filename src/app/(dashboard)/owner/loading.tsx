import { Skeleton } from '@/components/ui/skeleton';

export default function OwnerDashboardLoading() {
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in-50 duration-300">
      {/* Executive Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/40">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-64 rounded-lg" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-96 rounded-md" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </div>

      {/* Operational Alert Banner Placeholder */}
      <div className="p-4 rounded-2xl border border-border/60 bg-muted/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-48 rounded-md" />
            <Skeleton className="h-3 w-72 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>

      {/* Filter Bar Placeholder */}
      <div className="p-3 rounded-2xl border border-border/60 bg-card/60 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-8 w-36 rounded-lg" />
          <Skeleton className="h-8 w-44 rounded-lg" />
        </div>
      </div>

      {/* 6 Executive KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-4 rounded-2xl border border-border/60 bg-card/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-20 rounded-md" />
              <Skeleton className="size-6 rounded-md" />
            </div>
            <Skeleton className="h-7 w-28 rounded-md" />
            <Skeleton className="h-3 w-32 rounded-md" />
          </div>
        ))}
      </div>

      {/* Sales Trend Chart */}
      <div className="p-6 rounded-2xl border border-border/60 bg-card/60 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-44 rounded-md" />
            <Skeleton className="h-3.5 w-60 rounded-md" />
          </div>
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>

      {/* Operational Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl border border-border/60 bg-card/60 space-y-4">
          <Skeleton className="h-5 w-40 rounded-md" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-2.5 border-b border-border/30">
                <Skeleton className="h-4 w-36 rounded-md" />
                <Skeleton className="h-4 w-20 rounded-md" />
              </div>
            ))}
          </div>
        </div>
        <div className="p-6 rounded-2xl border border-border/60 bg-card/60 space-y-4">
          <Skeleton className="h-5 w-40 rounded-md" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-2.5 border-b border-border/30">
                <Skeleton className="h-4 w-36 rounded-md" />
                <Skeleton className="h-4 w-20 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
