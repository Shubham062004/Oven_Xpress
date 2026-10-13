import { Skeleton } from '@/components/ui/skeleton';

export default function AdminDashboardLoading() {
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in-50 duration-300">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/40">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-7 w-60 rounded-lg" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-80 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </div>

      {/* Admin Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-5 rounded-2xl border border-border/60 bg-card/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-24 rounded-md" />
              <Skeleton className="size-6 rounded-md" />
            </div>
            <Skeleton className="h-7 w-20 rounded-md" />
            <Skeleton className="h-3 w-36 rounded-md" />
          </div>
        ))}
      </div>

      {/* Admin Operations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl border border-border/60 bg-card/60 space-y-4">
          <Skeleton className="h-5 w-40 rounded-md" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-2.5 border-b border-border/30">
                <Skeleton className="h-4 w-44 rounded-md" />
                <Skeleton className="h-4 w-20 rounded-md" />
              </div>
            ))}
          </div>
        </div>
        <div className="p-6 rounded-2xl border border-border/60 bg-card/60 space-y-4">
          <Skeleton className="h-5 w-36 rounded-md" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-2.5 border-b border-border/30">
                <Skeleton className="h-4 w-48 rounded-md" />
                <Skeleton className="h-4 w-16 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
