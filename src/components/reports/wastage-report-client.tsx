'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Trash2,
  AlertTriangle,
  Layers,
  Search,
  FileSpreadsheet,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ReportViewContainer, type SummaryCardItem } from './report-view-container';
import { formatNumber } from '@/lib/reports/constants';
import type { WastageReportRow, WastageReportSummary, PaginationMeta, DateRangePreset } from '@/lib/reports/types';
import { exportWastageReportCSVAction } from '@/lib/reports/actions';

interface WastageReportClientProps {
  rows: WastageReportRow[];
  summary: WastageReportSummary;
  pagination: PaginationMeta;
  branches: Array<{ id: string; name: string; code: string }>;
  selectedBranchId: string;
  isBranchRestricted: boolean;
  selectedPreset: string;
  startDate?: string;
  endDate?: string;
  currentReason?: string;
  currentSearch?: string;
}

export function WastageReportClient({
  rows,
  summary,
  pagination,
  branches,
  selectedBranchId,
  isBranchRestricted,
  selectedPreset,
  startDate,
  endDate,
  currentReason = 'all',
  currentSearch = '',
}: WastageReportClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(currentSearch);

  const handleFilterChange = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (value === 'all' || !value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.set('page', '1');
    router.push(`/reports/wastage?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleFilterChange('search', search);
  };

  const topReason = summary.byReason?.[0]?.reason || 'None';
  const topIngredient = summary.byIngredient?.[0]?.ingredientName || 'None';

  const summaryCards: SummaryCardItem[] = [
    {
      title: 'Wastage Incidents',
      value: formatNumber(summary.totalEvents),
      subtitle: 'Recorded wastage & damage events',
      icon: <Trash2 className="w-4 h-4" />,
    },
    {
      title: 'Total Quantity Lost',
      value: formatNumber(summary.totalQuantity, 2),
      subtitle: 'Aggregated volume/mass across units',
      icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
    },
    {
      title: 'Primary Cause',
      value: topReason.replace(/_/g, ' '),
      subtitle: `${summary.byReason?.[0]?.count || 0} incidents recorded`,
      icon: <Layers className="w-4 h-4" />,
    },
    {
      title: 'Most Affected Item',
      value: topIngredient,
      subtitle: summary.byIngredient?.[0]
        ? `${formatNumber(summary.byIngredient[0].quantity, 1)} ${summary.byIngredient[0].unit}`
        : 'No loss recorded',
      icon: <FileSpreadsheet className="w-4 h-4" />,
    },
  ];

  const handleExport = async () => {
    const res = await exportWastageReportCSVAction({
      branchId: selectedBranchId,
      preset: selectedPreset as DateRangePreset,
      startDate,
      endDate,
      reason: currentReason === 'all' ? undefined : currentReason,
      search: currentSearch || undefined,
    });
    if (!res.success || !res.csv) throw new Error(res.error || 'Failed to export CSV');
    return res.csv;
  };

  return (
    <ReportViewContainer
      title="Wastage & Damage Report"
      description="Operational scrap, spoilage, and ingredient damage ledger from inventory movements."
      branches={branches}
      selectedBranchId={selectedBranchId}
      isBranchRestricted={isBranchRestricted}
      selectedPreset={selectedPreset}
      startDate={startDate}
      endDate={endDate}
      summaryCards={summaryCards}
      pagination={pagination}
      onExportCSV={handleExport}
      extraFilters={
        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search ingredient, notes, user..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </form>

          <Select
            value={currentReason}
            onValueChange={(val) => handleFilterChange('reason', val)}
          >
            <SelectTrigger className="w-[170px] h-9 text-xs">
              <SelectValue placeholder="All Reasons" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Reasons</SelectItem>
              <SelectItem value="EXPIRED">Expired</SelectItem>
              <SelectItem value="SPOILED">Spoiled</SelectItem>
              <SelectItem value="DROPPED_DAMAGED">Dropped / Damaged</SelectItem>
              <SelectItem value="OVERCOOKED_BURNT">Overcooked / Burnt</SelectItem>
              <SelectItem value="QUALITY_REJECTED">Quality Rejected</SelectItem>
              <SelectItem value="EQUIPMENT_FAILURE">Equipment Failure</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Breakdown Widgets */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border shadow-xs">
            <CardHeader className="py-3 px-4 bg-muted/20 border-b">
              <CardTitle className="text-xs font-semibold">Wastage by Reason</CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              {summary.byReason.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No wastage records</p>
              ) : (
                <div className="space-y-2">
                  {summary.byReason.map((r) => (
                    <div key={r.reason} className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground capitalize">
                        {r.reason.toLowerCase().replace(/_/g, ' ')}
                      </span>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-[10px]">
                          {r.count} events
                        </Badge>
                        <span className="font-mono text-muted-foreground">
                          {formatNumber(r.quantity, 2)} qty
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border shadow-xs">
            <CardHeader className="py-3 px-4 bg-muted/20 border-b">
              <CardTitle className="text-xs font-semibold">Most Wasted Ingredients</CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              {summary.byIngredient.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No wastage records</p>
              ) : (
                <div className="space-y-2">
                  {summary.byIngredient.slice(0, 5).map((ing) => (
                    <div key={ing.ingredientName} className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{ing.ingredientName}</span>
                      <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                        {formatNumber(ing.quantity, 2)} {ing.unit}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Detailed Records Table */}
        <Card className="border shadow-xs">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold text-xs">Date & Time</TableHead>
                    <TableHead className="font-semibold text-xs">Branch</TableHead>
                    <TableHead className="font-semibold text-xs">Ingredient</TableHead>
                    <TableHead className="font-semibold text-xs text-right">Quantity</TableHead>
                    <TableHead className="font-semibold text-xs">Unit</TableHead>
                    <TableHead className="font-semibold text-xs">Reason</TableHead>
                    <TableHead className="font-semibold text-xs">Notes / Details</TableHead>
                    <TableHead className="font-semibold text-xs">Reported By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-36 text-center text-muted-foreground text-sm">
                        No wastage records found for this period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow key={row.id} className="hover:bg-muted/30">
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(row.date).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell className="text-xs font-medium text-foreground">
                          {row.branchName}
                        </TableCell>
                        <TableCell className="text-xs font-medium">
                          {row.ingredientName}
                        </TableCell>
                        <TableCell className="text-xs text-right font-mono font-semibold text-rose-600 dark:text-rose-400">
                          {formatNumber(row.quantity, 2)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.unit}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="capitalize text-[11px]">
                            {row.reason.toLowerCase().replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                          {row.notes || '—'}
                        </TableCell>
                        <TableCell className="text-xs text-foreground font-medium">
                          {row.createdBy}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </ReportViewContainer>
  );
}
