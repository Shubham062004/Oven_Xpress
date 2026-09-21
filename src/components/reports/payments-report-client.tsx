'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  RotateCcw,
  IndianRupee,
  Search,
  ExternalLink,
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
import { formatCurrency, formatNumber } from '@/lib/reports/constants';
import type { PaymentsReportRow, PaymentsReportSummary, PaginationMeta, DateRangePreset } from '@/lib/reports/types';
import { exportPaymentsReportCSVAction } from '@/lib/reports/actions';

interface PaymentsReportClientProps {
  rows: PaymentsReportRow[];
  summary: PaymentsReportSummary;
  pagination: PaginationMeta;
  branches: Array<{ id: string; name: string; code: string }>;
  selectedBranchId: string;
  isBranchRestricted: boolean;
  selectedPreset: string;
  startDate?: string;
  endDate?: string;
  currentMethod?: string;
  currentStatus?: string;
  currentSearch?: string;
}

export function PaymentsReportClient({
  rows,
  summary,
  pagination,
  branches,
  selectedBranchId,
  isBranchRestricted,
  selectedPreset,
  startDate,
  endDate,
  currentMethod = 'all',
  currentStatus = 'all',
  currentSearch = '',
}: PaymentsReportClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(currentSearch);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(newPage));
    router.push(`?${params.toString()}`);
  };

  const handleMethodChange = (method: string | null) => {
    if (!method) return;
    const params = new URLSearchParams(searchParams.toString());
    if (method === 'all') params.delete('paymentMethod');
    else params.set('paymentMethod', method);
    params.delete('page');
    router.push(`?${params.toString()}`);
  };

  const handleStatusChange = (status: string | null) => {
    if (!status) return;
    const params = new URLSearchParams(searchParams.toString());
    if (status === 'all') params.delete('status');
    else params.set('status', status);
    params.delete('page');
    router.push(`?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (!searchInput) params.delete('search');
    else params.set('search', searchInput);
    params.delete('page');
    router.push(`?${params.toString()}`);
  };

  const handleExport = async () => {
    const res = await exportPaymentsReportCSVAction({
      branchId: selectedBranchId,
      preset: selectedPreset as DateRangePreset,
      startDate,
      endDate,
      paymentMethod: currentMethod,
      status: currentStatus,
      search: currentSearch,
    });
    return res.success ? res.csv : null;
  };

  const summaryCards: SummaryCardItem[] = [
    {
      label: 'Total Payments',
      value: formatNumber(summary.totalPaymentsCount),
      icon: CreditCard,
    },
    {
      label: 'Settled Count',
      value: formatNumber(summary.successfulCount),
      icon: CheckCircle2,
    },
    {
      label: 'Total Collected',
      value: formatCurrency(summary.successfulAmount),
      icon: IndianRupee,
    },
    {
      label: 'Failed Tenders',
      value: formatNumber(summary.failedCount),
      icon: XCircle,
    },
    {
      label: 'Failed Volume',
      value: formatCurrency(summary.failedAmount),
      icon: IndianRupee,
    },
    {
      label: 'Refunds Settled',
      value: formatCurrency(summary.refundedAmount),
      icon: RotateCcw,
    },
  ];

  const extraFilters = (
    <>
      <form onSubmit={handleSearchSubmit} className="relative w-44">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Payment # or Ref..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="h-9 pl-8 text-xs"
        />
      </form>

      <div className="w-32">
        <Select value={currentMethod} onValueChange={handleMethodChange}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="Tender" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tenders</SelectItem>
            <SelectItem value="CASH">Cash</SelectItem>
            <SelectItem value="UPI">UPI</SelectItem>
            <SelectItem value="CARD">Card</SelectItem>
            <SelectItem value="ONLINE">Online</SelectItem>
            <SelectItem value="OTHER">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="w-32">
        <Select value={currentStatus} onValueChange={handleStatusChange}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="SUCCESS">Success</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );

  return (
    <ReportViewContainer
      title="Payment & Tender Report"
      description="Audit-grade ledger of payment collections, tender breakdowns, gateway statuses, and refund deductions."
      icon={CreditCard}
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
      csvFilename={`payments-report-${selectedPreset}-${new Date().toISOString().split('T')[0]}.csv`}
      extraFilters={extraFilters}
    >
      <Card className="border border-border/60 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="font-semibold">Payment #</TableHead>
                  <TableHead className="font-semibold">Order #</TableHead>
                  <TableHead className="font-semibold">Branch</TableHead>
                  <TableHead className="font-semibold">Date & Time</TableHead>
                  <TableHead className="font-semibold">Method</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="text-right font-semibold">Amount</TableHead>
                  <TableHead className="text-right font-semibold">Refunded</TableHead>
                  <TableHead className="font-semibold">Reference #</TableHead>
                  <TableHead className="font-semibold">Cashier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-muted-foreground text-sm">
                      No payments found for the selected period.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((p) => (
                    <TableRow key={p.id} className="hover:bg-muted/20">
                      <TableCell className="font-medium text-xs font-mono text-foreground whitespace-nowrap">
                        {p.paymentNumber}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-primary whitespace-nowrap">
                        <Link href={`/orders/${p.orderId}`} className="hover:underline inline-flex items-center gap-1">
                          {p.orderNumber}
                          <ExternalLink className="h-3 w-3 print:hidden opacity-50" />
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.branchName}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(p.createdAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {p.method}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge
                          variant={p.status === 'SUCCESS' ? 'default' : p.status === 'FAILED' ? 'destructive' : 'secondary'}
                          className="text-[10px]"
                        >
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs font-bold font-mono text-foreground">
                        {formatCurrency(p.amount)}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono text-red-600 dark:text-red-400">
                        {p.refundedAmount > 0 ? formatCurrency(p.refundedAmount) : '—'}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {p.referenceNumber || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {p.processedBy}
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
