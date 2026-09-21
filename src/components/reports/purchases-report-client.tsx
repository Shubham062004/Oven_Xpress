'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShoppingBag,
  CheckCircle2,
  Clock,
  Truck,
  IndianRupee,
  Search,
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
import type { PurchasesReportRow, PurchasesReportSummary, PaginationMeta, DateRangePreset } from '@/lib/reports/types';
import { exportPurchasesReportCSVAction } from '@/lib/reports/actions';

interface PurchasesReportClientProps {
  rows: PurchasesReportRow[];
  summary: PurchasesReportSummary;
  pagination: PaginationMeta;
  branches: Array<{ id: string; name: string; code: string }>;
  suppliers: Array<{ id: string; name: string }>;
  selectedBranchId: string;
  isBranchRestricted: boolean;
  selectedPreset: string;
  startDate?: string;
  endDate?: string;
  currentSupplier?: string;
  currentStatus?: string;
  currentSearch?: string;
}

export function PurchasesReportClient({
  rows,
  summary,
  pagination,
  branches,
  suppliers,
  selectedBranchId,
  isBranchRestricted,
  selectedPreset,
  startDate,
  endDate,
  currentSupplier = 'all',
  currentStatus = 'all',
  currentSearch = '',
}: PurchasesReportClientProps) {
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
    router.push(`/reports/purchases?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleFilterChange('search', search);
  };

  const selectedBranchName =
    selectedBranchId === 'all'
      ? 'All Branches'
      : branches.find((b) => b.id === selectedBranchId)?.name || 'Current Branch';

  const summaryCards: SummaryCardItem[] = [
    {
      title: 'Total Purchase Orders',
      value: formatNumber(summary.totalOrders),
      subtitle: `${summary.receivedOrders} fully/partially received`,
      icon: <ShoppingBag className="w-4 h-4" />,
    },
    {
      title: 'Total Ordered Amount',
      value: formatCurrency(summary.totalOrderedAmount),
      subtitle: 'Committed procurement value',
      icon: <IndianRupee className="w-4 h-4" />,
    },
    {
      title: 'Total Received Amount',
      value: formatCurrency(summary.totalReceivedAmount),
      subtitle: 'Fulfilled delivery value',
      icon: <Truck className="w-4 h-4" />,
    },
    {
      title: 'Pending Fulfillment',
      value: formatNumber(summary.pendingOrders),
      subtitle: 'Awaiting delivery / verification',
      icon: <Clock className="w-4 h-4" />,
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RECEIVED':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Received
          </Badge>
        );
      case 'PARTIALLY_RECEIVED':
        return (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
            <Truck className="w-3 h-3 mr-1" />
            Partially Received
          </Badge>
        );
      case 'ORDERED':
        return (
          <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
            <Clock className="w-3 h-3 mr-1" />
            Ordered
          </Badge>
        );
      case 'CANCELLED':
        return (
          <Badge variant="destructive">
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleExport = async () => {
    const res = await exportPurchasesReportCSVAction({
      branchId: selectedBranchId,
      preset: selectedPreset as DateRangePreset,
      startDate,
      endDate,
      supplierId: currentSupplier === 'all' ? undefined : currentSupplier,
      status: currentStatus === 'all' ? undefined : currentStatus,
      search: currentSearch || undefined,
    });
    if (!res.success || !res.csv) throw new Error(res.error || 'Failed to export CSV');
    return res.csv;
  };

  return (
    <ReportViewContainer
      title="Purchase Report"
      description="Supplier procurement orders, fulfillment tracking, and received goods value."
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
              placeholder="Search PO number, supplier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </form>

          <Select
            value={currentSupplier}
            onValueChange={(val) => handleFilterChange('supplierId', val)}
          >
            <SelectTrigger className="w-[170px] h-9 text-xs">
              <SelectValue placeholder="All Suppliers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Suppliers</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={currentStatus}
            onValueChange={(val) => handleFilterChange('status', val)}
          >
            <SelectTrigger className="w-[150px] h-9 text-xs">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="ORDERED">Ordered</SelectItem>
              <SelectItem value="PARTIALLY_RECEIVED">Partially Received</SelectItem>
              <SelectItem value="RECEIVED">Received</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
    >
      <Card className="border shadow-xs">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold text-xs">PO Number</TableHead>
                  <TableHead className="font-semibold text-xs">Supplier</TableHead>
                  <TableHead className="font-semibold text-xs">Branch</TableHead>
                  <TableHead className="font-semibold text-xs">Order Date</TableHead>
                  <TableHead className="font-semibold text-xs">Expected Date</TableHead>
                  <TableHead className="font-semibold text-xs">Status</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Items</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Ordered Value</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Received Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-36 text-center text-muted-foreground text-sm">
                      No purchase orders found matching the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs font-medium">
                        {row.purchaseNumber}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-foreground">
                        {row.supplierName}
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="font-medium">{row.branchName}</span>
                        <span className="text-muted-foreground ml-1">({row.branchCode})</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(row.orderDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.expectedDate
                          ? new Date(row.expectedDate).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </TableCell>
                      <TableCell className="text-xs">{getStatusBadge(row.status)}</TableCell>
                      <TableCell className="text-xs text-right text-muted-foreground">
                        {formatNumber(row.itemCount)}
                      </TableCell>
                      <TableCell className="text-xs text-right font-medium">
                        {formatCurrency(row.totalAmount)}
                      </TableCell>
                      <TableCell className="text-xs text-right font-medium text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(row.receivedAmount)}
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
