import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in-50 duration-300">
      {/* Header bar skeleton */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border/40">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56 rounded-lg" />
          <Skeleton className="h-4 w-80 rounded-md" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>

      {/* KPI Cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-5 rounded-2xl border border-border/60 bg-card/60 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28 rounded-md" />
              <Skeleton className="size-8 rounded-full" />
            </div>
            <Skeleton className="h-8 w-36 rounded-md" />
            <Skeleton className="h-3.5 w-44 rounded-md" />
          </div>
        ))}
      </div>

      {/* Main chart & operational panel skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-2xl border border-border/60 bg-card/60 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-40 rounded-md" />
            <Skeleton className="h-8 w-28 rounded-lg" />
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
        <div className="p-6 rounded-2xl border border-border/60 bg-card/60 space-y-4">
          <Skeleton className="h-5 w-36 rounded-md" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border/30">
                <Skeleton className="h-4 w-32 rounded-md" />
                <Skeleton className="h-4 w-16 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
