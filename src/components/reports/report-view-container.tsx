'use client';

import React, { useTransition } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  Printer,
  Download,
  RefreshCw,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { downloadCSV } from '@/lib/reports/constants';
import type { PaginationMeta, DateRangePreset } from '@/lib/reports/types';

export interface SummaryCardItem {
  label?: string;
  title?: string;
  value: string | number;
  subtext?: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
}

export interface ReportViewContainerProps {
  title: string;
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
  branches: Array<{ id: string; name: string; code: string }>;
  selectedBranchId?: string;
  isBranchRestricted?: boolean;
  selectedPreset?: string;
  startDate?: string;
  endDate?: string;
  summaryCards?: SummaryCardItem[];
  pagination?: PaginationMeta;
  onPageChange?: (page: number) => void;
  onExportCSV?: () => Promise<string | { csv: string; filename?: string } | null>;
  csvFilename?: string;
  children: React.ReactNode;
  extraFilters?: React.ReactNode;
}

const PRESETS: Array<{ id: DateRangePreset; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: 'Last 7 Days' },
  { id: 'month', label: 'This Month' },
  { id: 'custom', label: 'Custom' },
];

export function ReportViewContainer({
  title,
  description,
  icon: Icon,
  branches,
  selectedBranchId = 'all',
  isBranchRestricted = false,
  selectedPreset = 'today',
  startDate,
  endDate,
  summaryCards = [],
  pagination,
  onPageChange,
  onExportCSV,
  csvFilename = 'report.csv',
  children,
  extraFilters,
}: ReportViewContainerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [isExporting, setIsExporting] = React.useState(false);

  const [customStart, setCustomStart] = React.useState(startDate || '');
  const [customEnd, setCustomEnd] = React.useState(endDate || '');

  const updateFilters = (updates: Record<string, string | null | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, val] of Object.entries(updates)) {
      if (val === null || val === undefined || val === '' || val === 'all') {
        params.delete(key);
      } else {
        params.set(key, val);
      }
    }
    // Always reset to page 1 on filter changes
    params.delete('page');

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handlePresetChange = (preset: string) => {
    if (preset === 'custom') {
      updateFilters({ preset: 'custom' });
    } else {
      updateFilters({
        preset,
        startDate: null,
        endDate: null,
      });
    }
  };

  const handleApplyCustomDates = () => {
    if (customStart && customEnd) {
      updateFilters({
        preset: 'custom',
        startDate: customStart,
        endDate: customEnd,
      });
    }
  };

  const handleBranchChange = (branchId: string | null) => {
    if (branchId) {
      updateFilters({ branchId });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = async () => {
    if (!onExportCSV) return;
    try {
      setIsExporting(true);
      const res = await onExportCSV();
      if (!res) return;
      if (typeof res === 'string') {
        downloadCSV(res, csvFilename);
      } else if (typeof res === 'object' && res.csv) {
        downloadCSV(res.csv, res.filename || csvFilename);
      }
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const activeBranchName =
    selectedBranchId === 'all'
      ? 'All Branches'
      : branches.find((b) => b.id === selectedBranchId)?.name || 'Assigned Branch';

  const dateRangeLabel =
    selectedPreset === 'custom' && startDate && endDate
      ? `${startDate} to ${endDate}`
      : PRESETS.find((p) => p.id === selectedPreset)?.label || 'Today';

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8">
      {/* ─── PRINT ONLY AUDIT HEADER ─── */}
      <div className="hidden print:block mb-6 border-b border-gray-400 pb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Oven Xpress</h1>
            <h2 className="text-lg font-semibold text-gray-700 mt-1">{title}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          </div>
          <div className="text-right text-xs text-gray-600 space-y-1">
            <p><strong>Scope:</strong> {activeBranchName}</p>
            <p><strong>Period:</strong> {dateRangeLabel}</p>
            <p><strong>Printed:</strong> {new Date().toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* ─── SCREEN HEADER & TOOLBAR ─── */}
      <div className="print:hidden flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Link
              href="/reports"
              className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Reports Directory
            </Link>
          </div>
          <div className="flex items-center gap-2.5">
            {Icon && (
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
            )}
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">
                {title}
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                {description}
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="h-9 gap-1.5 text-xs shadow-sm"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </Button>

          {onExportCSV && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting}
              className="h-9 gap-1.5 text-xs shadow-sm"
            >
              <Download className="h-3.5 w-3.5" />
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.refresh()}
            disabled={isPending}
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            title="Refresh Data"
          >
            <RefreshCw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* ─── GLOBAL FILTER BAR ─── */}
      <Card className="print:hidden border border-border/60 shadow-sm p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 flex-wrap">
          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {PRESETS.map((p) => {
              const isSelected = selectedPreset === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => handlePresetChange(p.id)}
                  className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all shrink-0 ${
                    isSelected
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/40 text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Branch & Extra Dropdowns */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Custom date range inputs */}
            {selectedPreset === 'custom' && (
              <div className="flex items-center gap-1.5">
                <Input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-8 text-xs w-34"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-8 text-xs w-34"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleApplyCustomDates}
                  className="h-8 text-xs px-2.5"
                >
                  Apply
                </Button>
              </div>
            )}

            {/* Branch Selector */}
            {!isBranchRestricted && (
              <div className="w-48">
                <Select value={selectedBranchId} onValueChange={handleBranchChange}>
                  <SelectTrigger className="h-9 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <SelectValue placeholder="All Branches" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accessible Branches</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {extraFilters}
          </div>
        </div>
      </Card>

      {/* ─── SUMMARY KPI CARDS ─── */}
      {summaryCards.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {summaryCards.map((c, idx) => {
            const cardTitle = c.label || c.title || '';
            const cardSub = c.subtext || c.subtitle;
            const renderIcon = () => {
              if (!c.icon) return <Calendar className="h-3.5 w-3.5" />;
              if (React.isValidElement(c.icon)) return c.icon;
              const IconComp = c.icon as React.ComponentType<{ className?: string }>;
              return <IconComp className="h-3.5 w-3.5" />;
            };
            return (
              <Card key={idx} className="border border-border/50 shadow-xs p-3">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between text-muted-foreground mb-1">
                    <span className="text-[11px] font-medium uppercase tracking-wider">
                      {cardTitle}
                    </span>
                    {renderIcon()}
                  </div>
                  <div className="text-lg font-bold text-foreground tracking-tight">
                    {c.value}
                  </div>
                  {cardSub && (
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {cardSub}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ─── REPORT DATA TABLE (CHILDREN) ─── */}
      <div className={`${isPending ? 'opacity-50 pointer-events-none transition-opacity' : ''}`}>
        {children}
      </div>

      {/* ─── PAGINATION CONTROLS ─── */}
      {pagination && pagination.totalPages > 1 && (
        <div className="print:hidden flex items-center justify-between p-3 border rounded-xl bg-card text-xs text-muted-foreground">
          <span>
            Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total records)
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange?.(pagination.page - 1)}
              disabled={pagination.page <= 1 || isPending}
              className="h-8 gap-1 text-xs"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </Button>
            <span className="font-semibold text-foreground px-2">
              {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange?.(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || isPending}
              className="h-8 gap-1 text-xs"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
