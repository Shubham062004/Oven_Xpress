'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  TrendingUp,
  ShoppingCart,
  Percent,
  RotateCcw,
  IndianRupee,
  Scale,
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
import { ReportViewContainer, type SummaryCardItem } from './report-view-container';
import { formatCurrency, formatNumber } from '@/lib/reports/constants';
import type { SalesReportRow, SalesReportSummary, PaginationMeta, DateRangePreset } from '@/lib/reports/types';
import { exportSalesReportCSVAction } from '@/lib/reports/actions';

interface SalesReportClientProps {
  rows: SalesReportRow[];
  summary: SalesReportSummary;
  pagination: PaginationMeta;
  branches: Array<{ id: string; name: string; code: string }>;
  selectedBranchId: string;
  isBranchRestricted: boolean;
  selectedPreset: string;
  startDate?: string;
  endDate?: string;
}

export function SalesReportClient({
  rows,
  summary,
  pagination,
  branches,
  selectedBranchId,
  isBranchRestricted,
  selectedPreset,
  startDate,
  endDate,
}: SalesReportClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(newPage));
    router.push(`?${params.toString()}`);
  };

  const handleExport = async () => {
    const res = await exportSalesReportCSVAction({
      branchId: selectedBranchId,
      preset: selectedPreset as DateRangePreset,
      startDate,
      endDate,
    });
    return res.success ? res.csv : null;
  };

  const summaryCards: SummaryCardItem[] = [
    {
      label: 'Gross Sales',
      value: formatCurrency(summary.grossSales),
      icon: IndianRupee,
    },
    {
      label: 'Discounts',
      value: formatCurrency(summary.discounts),
      icon: Percent,
    },
    {
      label: 'Refunds',
      value: formatCurrency(summary.refunds),
      icon: RotateCcw,
    },
    {
      label: 'Net Sales',
      value: formatCurrency(summary.netSales),
      icon: TrendingUp,
    },
    {
      label: 'Completed Orders',
      value: formatNumber(summary.totalOrders),
      icon: ShoppingCart,
    },
    {
      label: 'Avg Order Value',
      value: formatCurrency(summary.averageOrderValue),
      icon: Scale,
    },
  ];

  return (
    <ReportViewContainer
      title="Sales & Revenue Report"
      description="Daily breakdown of sales revenue, promotional discounts, customer refunds, and average order values."
      icon={TrendingUp}
      branches={branches}
      selectedBranchId={selectedBranchId}
      isBranchRestricted={isBranchRestricted}
      selectedPreset={selectedPreset}
      startDate={startDate}
      endDate={endDate}
      summaryCards={summaryCards}
      pagination={pagination}
      onPageChange={handlePageChange}
      onExportCSV={handleExport}
      csvFilename={`sales-report-${selectedPreset}-${new Date().toISOString().split('T')[0]}.csv`}
    >
      <Card className="border border-border/60 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="font-semibold">Date</TableHead>
                  <TableHead className="font-semibold">Branch</TableHead>
                  <TableHead className="text-right font-semibold">Orders</TableHead>
                  <TableHead className="text-right font-semibold">Gross Sales</TableHead>
                  <TableHead className="text-right font-semibold">Discounts</TableHead>
                  <TableHead className="text-right font-semibold">Refunds</TableHead>
                  <TableHead className="text-right font-semibold">Net Sales</TableHead>
                  <TableHead className="text-right font-semibold">AOV</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                      No sales records found for the selected period and branch.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r, i) => (
                    <TableRow key={i} className="hover:bg-muted/20">
                      <TableCell className="font-medium text-xs text-foreground whitespace-nowrap">
                        {r.date}
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="font-semibold text-foreground">{r.branchName}</span>
                        <span className="text-[10px] text-muted-foreground ml-1 font-mono">({r.branchCode})</span>
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono">
                        {formatNumber(r.orderCount)}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono">
                        {formatCurrency(r.grossSales)}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono text-amber-600 dark:text-amber-400">
                        {r.discounts > 0 ? `-${formatCurrency(r.discounts)}` : '₹0.00'}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono text-red-600 dark:text-red-400">
                        {r.refunds > 0 ? `-${formatCurrency(r.refunds)}` : '₹0.00'}
                      </TableCell>
                      <TableCell className="text-right text-xs font-bold font-mono text-primary">
                        {formatCurrency(r.netSales)}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono text-muted-foreground">
                        {formatCurrency(r.averageOrderValue)}
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
