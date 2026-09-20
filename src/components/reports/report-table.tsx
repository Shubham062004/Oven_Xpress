import React from 'react';
import { Download } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface ReportTableWrapperProps {
  title: string;
  description?: string;
  onExportCSV?: () => void;
  exportLoading?: boolean;
  exportDisabled?: boolean;
  actionSlot?: React.ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
  className?: string;
}

export function ReportTableWrapper({
  title,
  description,
  onExportCSV,
  exportLoading = false,
  exportDisabled = false,
  actionSlot,
  loading = false,
  empty = false,
  emptyMessage = 'No report data found for the selected period.',
  children,
  className = '',
}: ReportTableWrapperProps) {
  return (
    <Card className={`rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden shadow-xs ${className}`}>
      <CardHeader className="p-5 border-b border-border/40 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <CardTitle className="text-base font-semibold tracking-tight">{title}</CardTitle>
          {description && (
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              {description}
            </CardDescription>
          )}
        </div>

        <div className="flex items-center gap-2">
          {actionSlot}
          {onExportCSV && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onExportCSV}
              disabled={exportDisabled || exportLoading}
              className="h-8 px-3 text-xs font-medium rounded-lg border-border/60 gap-1.5 hover:bg-muted/50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              {exportLoading ? 'Exporting...' : 'Export CSV'}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : empty ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            <div className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center mx-auto mb-2 text-muted-foreground/60">
              📊
            </div>
            <p>{emptyMessage}</p>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
