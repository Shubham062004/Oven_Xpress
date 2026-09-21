'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Receipt,
  CheckCircle2,
  Clock,
  XCircle,
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
import type { ExpensesReportRow, ExpensesReportSummary, PaginationMeta } from '@/lib/reports/types';
import { exportExpensesReportCSVAction } from '@/lib/reports/actions';

interface ExpensesReportClientProps {
  rows: ExpensesReportRow[];
  summary: ExpensesReportSummary;
  pagination: PaginationMeta;
  branches: Array<{ id: string; name: string; code: string }>;
  categories: Array<{ id: string; name: string }>;
  selectedBranchId: string;
  isBranchRestricted: boolean;
  selectedPreset: string;
  startDate?: string;
  endDate?: string;
  currentCategory?: string;
  currentStatus?: string;
  currentSearch?: string;
}

export function ExpensesReportClient({
  rows,
  summary,
  pagination,
  branches,
  categories,
  selectedBranchId,
  isBranchRestricted,
  selectedPreset,
  startDate,
  endDate,
  currentCategory = 'all',
  currentStatus = 'all',
  currentSearch = '',
}: ExpensesReportClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(currentSearch);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(newPage));
    router.push(`?${params.toString()}`);
  };

  const handleCategoryChange = (categoryId: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!categoryId || categoryId === 'all') params.delete('categoryId');
    else params.set('categoryId', categoryId);
    params.delete('page');
    router.push(`?${params.toString()}`);
  };

  const handleStatusChange = (status: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!status || status === 'all') params.delete('status');
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
    const res = await exportExpensesReportCSVAction({
      branchId: selectedBranchId,
      preset: selectedPreset as any,
      startDate,
      endDate,
      categoryId: currentCategory,
      status: currentStatus,
      search: currentSearch,
    });
    return res.success && res.csv ? { csv: res.csv, filename: res.filename } : null;
  };

  const summaryCards: SummaryCardItem[] = [
    {
      label: 'Total Expenses',
      value: formatNumber(summary.totalExpensesCount),
      icon: Receipt,
    },
    {
      label: 'Approved Count',
      value: formatNumber(summary.approvedCount),
      icon: CheckCircle2,
    },
    {
      label: 'Approved Outlay',
      value: formatCurrency(summary.approvedAmount),
      icon: IndianRupee,
    },
    {
      label: 'Pending Approval',
      value: formatNumber(summary.pendingCount),
      icon: Clock,
    },
    {
      label: 'Pending Volume',
      value: formatCurrency(summary.pendingAmount),
      icon: IndianRupee,
    },
    {
      label: 'Rejected Count',
      value: formatNumber(summary.rejectedCount),
      icon: XCircle,
    },
  ];

  const extraFilters = (
    <>
      <form onSubmit={handleSearchSubmit} className="relative w-44">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Expense # or Vendor..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="h-9 pl-8 text-xs"
        />
      </form>

      {categories.length > 0 && (
        <div className="w-36">
          <Select value={currentCategory} onValueChange={handleCategoryChange}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="w-32">
        <Select value={currentStatus} onValueChange={handleStatusChange}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="PENDING_APPROVAL">Pending</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );

  return (
    <ReportViewContainer
      title="Operating Expense Report"
      description="Detailed ledger of store operating expenses, category disbursements, vendors, and approval records."
      icon={Receipt}
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
      csvFilename={`expenses-report-${selectedPreset}-${new Date().toISOString().split('T')[0]}.csv`}
      extraFilters={extraFilters}
    >
      <Card className="border border-border/60 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="font-semibold">Expense #</TableHead>
                  <TableHead className="font-semibold">Date</TableHead>
                  <TableHead className="font-semibold">Branch</TableHead>
                  <TableHead className="font-semibold">Category</TableHead>
                  <TableHead className="text-right font-semibold">Amount</TableHead>
                  <TableHead className="font-semibold">Method</TableHead>
                  <TableHead className="font-semibold">Vendor</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground text-sm">
                      No expenses found for the selected period.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((e) => (
                    <TableRow key={e.id} className="hover:bg-muted/20">
                      <TableCell className="font-medium text-xs font-mono text-foreground whitespace-nowrap">
                        {e.expenseNumber}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {e.date}
                      </TableCell>
                      <TableCell className="text-xs text-foreground">
                        {e.branchName}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[10px]">
                          {e.categoryName}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs font-bold font-mono text-foreground">
                        {formatCurrency(e.amount)}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {e.paymentMethod}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {e.vendor || '—'}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge
                          variant={e.status === 'APPROVED' ? 'default' : e.status === 'REJECTED' ? 'destructive' : 'secondary'}
                          className="text-[10px]"
                        >
                          {e.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {e.description}
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
