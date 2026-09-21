'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ShoppingCart,
  CheckCircle2,
  XCircle,
  IndianRupee,
  Percent,
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
import type { OrdersReportRow, OrdersReportSummary, PaginationMeta, DateRangePreset } from '@/lib/reports/types';
import { exportOrdersReportCSVAction } from '@/lib/reports/actions';

interface OrdersReportClientProps {
  rows: OrdersReportRow[];
  summary: OrdersReportSummary;
  pagination: PaginationMeta;
  branches: Array<{ id: string; name: string; code: string }>;
  selectedBranchId: string;
  isBranchRestricted: boolean;
  selectedPreset: string;
  startDate?: string;
  endDate?: string;
  currentStatus?: string;
  currentOrderType?: string;
  currentSearch?: string;
}

export function OrdersReportClient({
  rows,
  summary,
  pagination,
  branches,
  selectedBranchId,
  isBranchRestricted,
  selectedPreset,
  startDate,
  endDate,
  currentStatus = 'all',
  currentOrderType = 'all',
  currentSearch = '',
}: OrdersReportClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(currentSearch);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(newPage));
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

  const handleOrderTypeChange = (orderType: string | null) => {
    if (!orderType) return;
    const params = new URLSearchParams(searchParams.toString());
    if (orderType === 'all') params.delete('orderType');
    else params.set('orderType', orderType);
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
    const res = await exportOrdersReportCSVAction({
      branchId: selectedBranchId,
      preset: selectedPreset as DateRangePreset,
      startDate,
      endDate,
      status: currentStatus,
      orderType: currentOrderType,
      search: currentSearch,
    });
    return res.success ? res.csv : null;
  };

  const summaryCards: SummaryCardItem[] = [
    {
      label: 'Total Orders',
      value: formatNumber(summary.totalOrders),
      icon: ShoppingCart,
    },
    {
      label: 'Completed',
      value: formatNumber(summary.completedOrders),
      icon: CheckCircle2,
    },
    {
      label: 'Cancelled',
      value: formatNumber(summary.cancelledOrders),
      icon: XCircle,
    },
    {
      label: 'Gross Volume',
      value: formatCurrency(summary.totalAmount),
      icon: IndianRupee,
    },
    {
      label: 'Discounts',
      value: formatCurrency(summary.totalDiscounts),
      icon: Percent,
    },
    {
      label: 'Average Ticket',
      value: formatCurrency(summary.averageOrderTotal),
      icon: IndianRupee,
    },
  ];

  const extraFilters = (
    <>
      <form onSubmit={handleSearchSubmit} className="relative w-44">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Order # or Name..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="h-9 pl-8 text-xs"
        />
      </form>

      <div className="w-32">
        <Select value={currentStatus} onValueChange={handleStatusChange}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="CONFIRMED">Confirmed</SelectItem>
            <SelectItem value="PREPARING">Preparing</SelectItem>
            <SelectItem value="READY">Ready</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
            <SelectItem value="REFUNDED">Refunded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="w-32">
        <Select value={currentOrderType} onValueChange={handleOrderTypeChange}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            <SelectItem value="DINE_IN">Dine-In</SelectItem>
            <SelectItem value="TAKEAWAY">Takeaway</SelectItem>
            <SelectItem value="DELIVERY">Delivery</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );

  return (
    <ReportViewContainer
      title="Orders Report"
      description="Comprehensive order transactions, kitchen pipeline statuses, dining channels, and financial totals."
      icon={ShoppingCart}
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
      csvFilename={`orders-report-${selectedPreset}-${new Date().toISOString().split('T')[0]}.csv`}
      extraFilters={extraFilters}
    >
      <Card className="border border-border/60 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="font-semibold">Order #</TableHead>
                  <TableHead className="font-semibold">Date & Time</TableHead>
                  <TableHead className="font-semibold">Branch</TableHead>
                  <TableHead className="font-semibold">Channel</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Customer</TableHead>
                  <TableHead className="text-right font-semibold">Subtotal</TableHead>
                  <TableHead className="text-right font-semibold">Discount</TableHead>
                  <TableHead className="text-right font-semibold">Tax</TableHead>
                  <TableHead className="text-right font-semibold">Total</TableHead>
                  <TableHead className="font-semibold">Payment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-12 text-muted-foreground text-sm">
                      No orders found matching the filter criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((o) => (
                    <TableRow key={o.id} className="hover:bg-muted/20">
                      <TableCell className="font-medium text-xs font-mono text-primary whitespace-nowrap">
                        <Link href={`/orders/${o.id}`} className="hover:underline inline-flex items-center gap-1">
                          {o.orderNumber}
                          <ExternalLink className="h-3 w-3 print:hidden opacity-50" />
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(o.createdAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="font-medium text-foreground">{o.branchName}</span>
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {o.orderType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge
                          variant={o.status === 'COMPLETED' ? 'default' : o.status === 'CANCELLED' ? 'destructive' : 'secondary'}
                          className="text-[10px]"
                        >
                          {o.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-foreground">
                        <div>{o.customerName}</div>
                        {o.customerPhone && (
                          <div className="text-[10px] text-muted-foreground font-mono">{o.customerPhone}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono">
                        {formatCurrency(o.subtotal)}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono text-amber-600 dark:text-amber-400">
                        {o.discountAmount > 0 ? `-${formatCurrency(o.discountAmount)}` : '—'}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono text-muted-foreground">
                        {formatCurrency(o.taxAmount)}
                      </TableCell>
                      <TableCell className="text-right text-xs font-bold font-mono text-foreground">
                        {formatCurrency(o.totalAmount)}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[10px]">
                          {o.paymentStatus}
                        </Badge>
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
