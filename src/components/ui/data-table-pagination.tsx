'use client';

import * as React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface DataTablePaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  disabled?: boolean;
  isLoading?: boolean;
  itemLabel?: string;
  className?: string;
}

export function getVisiblePages(current: number, total: number): (number | string)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, '...', total];
  }
  if (current >= total - 3) {
    return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, '...', current - 1, current, current + 1, '...', total];
}

export function DataTablePagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  disabled = false,
  isLoading = false,
  itemLabel = 'entries',
  className,
}: DataTablePaginationProps) {
  const isDisabled = disabled || isLoading;
  const activePage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages));
  const startIndex = totalItems === 0 ? 0 : (activePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  if (totalItems === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border/60 px-4 py-3 text-xs text-muted-foreground',
        className
      )}
    >
      {/* Items Counter */}
      <div className="font-medium text-center sm:text-left">
        Showing <span className="font-semibold text-foreground">{startIndex + 1}</span> to{' '}
        <span className="font-semibold text-foreground">{endIndex}</span> of{' '}
        <span className="font-semibold text-foreground">{totalItems}</span> {itemLabel}
      </div>

      {/* Right Controls */}
      <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 sm:gap-4">
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <Select
              value={pageSize.toString()}
              onValueChange={(val) => {
                if (val) onPageSizeChange(Number(val));
              }}
              disabled={isDisabled}
            >
              <SelectTrigger className="h-8 w-18 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {pageSizeOptions.map((opt) => (
                  <SelectItem key={opt} value={opt.toString()}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(1)}
            disabled={activePage <= 1 || isDisabled}
            title="First page"
            aria-label="First page"
            className="size-8"
          >
            <ChevronsLeft className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(activePage - 1)}
            disabled={activePage <= 1 || isDisabled}
            title="Previous page"
            aria-label="Previous page"
            className="size-8"
          >
            <ChevronLeft className="size-3.5" />
          </Button>

          <div className="flex items-center gap-1 mx-1">
            {getVisiblePages(activePage, totalPages).map((p, idx) => {
              if (p === '...') {
                return (
                  <span
                    key={`dots-${idx}`}
                    className="px-1 text-muted-foreground select-none"
                  >
                    ...
                  </span>
                );
              }
              const pageNum = Number(p);
              const isActive = pageNum === activePage;
              return (
                <Button
                  key={pageNum}
                  variant={isActive ? 'default' : 'outline'}
                  size="icon-sm"
                  onClick={() => onPageChange(pageNum)}
                  disabled={isDisabled}
                  className={cn(
                    'size-8 text-xs',
                    isActive ? 'font-semibold shadow-xs' : 'font-normal hover:bg-muted'
                  )}
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(activePage + 1)}
            disabled={activePage >= totalPages || isDisabled}
            title="Next page"
            aria-label="Next page"
            className="size-8"
          >
            <ChevronRight className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(totalPages)}
            disabled={activePage >= totalPages || isDisabled}
            title="Last page"
            aria-label="Last page"
            className="size-8"
          >
            <ChevronsRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
