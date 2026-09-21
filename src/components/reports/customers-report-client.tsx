'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Users,
  ShoppingBag,
  IndianRupee,
  Star,
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
import type { CustomersReportRow, CustomersReportSummary, PaginationMeta } from '@/lib/reports/types';
import { exportCustomersReportCSVAction } from '@/lib/reports/actions';

interface CustomersReportClientProps {
  rows: CustomersReportRow[];
  summary: CustomersReportSummary;
  pagination: PaginationMeta;
  branches: Array<{ id: string; name: string; code: string }>;
  selectedBranchId: string;
  isBranchRestricted: boolean;
  selectedPreset: string;
  startDate?: string;
  endDate?: string;
  currentStatus?: string;
  currentSearch?: string;
}

export function CustomersReportClient({
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
  currentSearch = '',
}: CustomersReportClientProps) {
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
    router.push(`/reports/customers?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleFilterChange('search', search);
  };

  const summaryCards: SummaryCardItem[] = [
    {
      title: 'Total Customers',
      value: formatNumber(summary.totalCustomers),
      subtitle: `${summary.activeCustomers} currently active profiles`,
      icon: <Users className="w-4 h-4" />,
    },
    {
      title: 'Transacting Guests',
      value: formatNumber(summary.customersWithOrders),
      subtitle: `${Math.round(((summary.customersWithOrders || 0) / (summary.totalCustomers || 1)) * 100)}% with order history`,
      icon: <ShoppingBag className="w-4 h-4" />,
    },
    {
      title: 'Cumulative Spend',
      value: formatCurrency(summary.totalSpend),
      subtitle: 'Fulfilled dining volume across all stores',
      icon: <IndianRupee className="w-4 h-4" />,
    },
    {
      title: 'Average Experience Rating',
      value: summary.averageRating > 0 ? `${summary.averageRating.toFixed(1)} / 5.0` : 'N/A',
      subtitle: 'Feedback score from verified diners',
      icon: <Star className="w-4 h-4 text-amber-500" />,
    },
  ];

  const handleExport = async () => {
    const res = await exportCustomersReportCSVAction({
      status: currentStatus === 'all' ? undefined : currentStatus,
      search: currentSearch || undefined,
    });
    if (!res.success || !res.csv) throw new Error(res.error || 'Failed to export CSV');
    return res.csv;
  };

  return (
    <ReportViewContainer
      title="Customer Activity Report"
      description="Aggregated customer engagement metrics, transaction counts, and feedback history."
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
              placeholder="Search name, phone, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </form>

          <Select
            value={currentStatus}
            onValueChange={(val) => handleFilterChange('status', val)}
          >
            <SelectTrigger className="w-[150px] h-9 text-xs">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
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
                  <TableHead className="font-semibold text-xs">Customer</TableHead>
                  <TableHead className="font-semibold text-xs">Contact</TableHead>
                  <TableHead className="font-semibold text-xs">Status</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Orders</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Completed</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Total Spend</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Reviews</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Avg Rating</TableHead>
                  <TableHead className="font-semibold text-xs">Last Order</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-36 text-center text-muted-foreground text-sm">
                      No customer records found matching the search criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id} className="hover:bg-muted/30">
                      <TableCell className="text-xs font-medium text-foreground">
                        {row.name}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.phone || row.email || '—'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {row.status === 'ACTIVE' ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-right font-medium">
                        {formatNumber(row.totalOrders)}
                      </TableCell>
                      <TableCell className="text-xs text-right text-muted-foreground">
                        {formatNumber(row.completedOrders)}
                      </TableCell>
                      <TableCell className="text-xs text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(row.totalSpend)}
                      </TableCell>
                      <TableCell className="text-xs text-right text-muted-foreground">
                        {formatNumber(row.reviewCount)}
                      </TableCell>
                      <TableCell className="text-xs text-right">
                        {row.averageRating > 0 ? (
                          <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                            <Star className="w-3 h-3 fill-amber-500" />
                            {row.averageRating.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {row.lastOrderDate
                          ? new Date(row.lastOrderDate).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
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
