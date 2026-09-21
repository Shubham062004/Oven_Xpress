'use client';

import React, { useState } from 'react';
import {
  Building2,
  ShoppingCart,
  TrendingUp,
  CreditCard,
  Receipt,
  Scale,
  ArrowUpDown,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ReportViewContainer, type SummaryCardItem } from './report-view-container';
import { formatCurrency, formatNumber } from '@/lib/reports/constants';
import type { BranchReportRow, BranchReportSummary, DateRangePreset } from '@/lib/reports/types';
import { exportBranchesReportCSVAction } from '@/lib/reports/actions';

interface BranchesReportClientProps {
  rows: BranchReportRow[];
  summary: BranchReportSummary;
  branches: Array<{ id: string; name: string; code: string }>;
  selectedPreset: string;
  startDate?: string;
  endDate?: string;
}

type SortField = 'branchName' | 'orderCount' | 'netSales' | 'averageOrderValue' | 'operatingResult';

export function BranchesReportClient({
  rows,
  summary,
  branches,
  selectedPreset,
  startDate,
  endDate,
}: BranchesReportClientProps) {
  const [sortField, setSortField] = useState<SortField>('branchName');
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const sortedRows = [...rows].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'branchName') {
      cmp = a.branchName.localeCompare(b.branchName);
    } else {
      cmp = a[sortField] - b[sortField];
    }
    return sortAsc ? cmp : -cmp;
  });

  const handleExport = async () => {
    const res = await exportBranchesReportCSVAction({
      preset: selectedPreset as DateRangePreset,
      startDate,
      endDate,
    });
    return res.success && res.csv ? { csv: res.csv, filename: res.filename } : null;
  };

  const summaryCards: SummaryCardItem[] = [
    {
      label: 'Branches Tracked',
      value: formatNumber(summary.branchCount),
      icon: Building2,
    },
    {
      label: 'Total Orders',
      value: formatNumber(summary.totalOrders),
      icon: ShoppingCart,
    },
    {
      label: 'Total Net Sales',
      value: formatCurrency(summary.totalNetSales),
      icon: TrendingUp,
    },
    {
      label: 'Payments Collected',
      value: formatCurrency(summary.totalPayments),
      icon: CreditCard,
    },
    {
      label: 'Approved Expenses',
      value: formatCurrency(summary.totalExpenses),
      icon: Receipt,
    },
    {
      label: 'Operating Margin',
      value: formatCurrency(summary.totalOperatingResult),
      icon: Scale,
    },
  ];

  return (
    <ReportViewContainer
      title="Branch Performance Report"
      description="Factual comparative operational benchmarks, sales volumes, and financial flows across store locations."
      icon={Building2}
      branches={branches}
      selectedPreset={selectedPreset}
      startDate={startDate}
      endDate={endDate}
      summaryCards={summaryCards}
      onExportCSV={handleExport}
      csvFilename={`branches-report-${selectedPreset}-${new Date().toISOString().split('T')[0]}.csv`}
    >
      <Card className="border border-border/60 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('branchName')}
                      className="-ml-3 h-8 text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground"
                    >
                      Branch Location
                      <ArrowUpDown className="h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('orderCount')}
                      className="ml-auto h-8 text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground"
                    >
                      Orders
                      <ArrowUpDown className="h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('netSales')}
                      className="ml-auto h-8 text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground"
                    >
                      Net Sales
                      <ArrowUpDown className="h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('averageOrderValue')}
                      className="ml-auto h-8 text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground"
                    >
                      AOV
                      <ArrowUpDown className="h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right font-semibold">Payments Collected</TableHead>
                  <TableHead className="text-right font-semibold">Approved Expenses</TableHead>
                  <TableHead className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('operatingResult')}
                      className="ml-auto h-8 text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground"
                    >
                      Operating Result
                      <ArrowUpDown className="h-3 w-3" />
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                      No branch performance metrics available.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedRows.map((b) => (
                    <TableRow key={b.branchId} className="hover:bg-muted/20">
                      <TableCell className="text-xs">
                        <span className="font-bold text-foreground">{b.branchName}</span>
                        <span className="text-[10px] text-muted-foreground ml-1 font-mono">({b.branchCode})</span>
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono font-medium">
                        {formatNumber(b.orderCount)}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono font-bold text-primary">
                        {formatCurrency(b.netSales)}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono text-muted-foreground">
                        {formatCurrency(b.averageOrderValue)}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono text-foreground">
                        {formatCurrency(b.successfulPayments)}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono text-red-600 dark:text-red-400">
                        {formatCurrency(b.approvedExpenses)}
                      </TableCell>
                      <TableCell className={`text-right text-xs font-bold font-mono ${
                        b.operatingResult >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {formatCurrency(b.operatingResult)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </ReportViewContainer>
  );
}
