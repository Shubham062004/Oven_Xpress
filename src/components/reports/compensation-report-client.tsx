'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Banknote,
  CheckCircle2,
  Clock,
  Gift,
  TrendingUp,
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
import type { CompensationReportRow, CompensationReportSummary, PaginationMeta, DateRangePreset } from '@/lib/reports/types';
import { exportCompensationReportCSVAction } from '@/lib/reports/actions';

interface CompensationReportClientProps {
  rows: CompensationReportRow[];
  summary: CompensationReportSummary;
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

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export function CompensationReportClient({
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
}: CompensationReportClientProps) {
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
    router.push(`/reports/compensation?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleFilterChange('search', search);
  };

  const summaryCards: SummaryCardItem[] = [
    {
      title: 'Salary Records',
      value: formatNumber(summary.totalRecords),
      subtitle: 'Employee payroll records in period',
      icon: <Banknote className="w-4 h-4" />,
    },
    {
      title: 'Total Gross Compensation',
      value: formatCurrency(summary.totalGrossAmount),
      subtitle: `Base salary: ${formatCurrency(summary.totalBaseSalary)}`,
      icon: <TrendingUp className="w-4 h-4 text-emerald-500" />,
    },
    {
      title: 'Performance & Bonuses',
      value: formatCurrency(summary.totalBonus + summary.totalIncentive),
      subtitle: `Bonus: ${formatCurrency(summary.totalBonus)} • Incentives: ${formatCurrency(summary.totalIncentive)}`,
      icon: <Gift className="w-4 h-4 text-purple-500" />,
    },
    {
      title: 'Total Net Payout',
      value: formatCurrency(summary.totalNetAmount),
      subtitle: 'Final approved disbursement figure',
      icon: <Banknote className="w-4 h-4 text-blue-500" />,
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Paid
          </Badge>
        );
      case 'APPROVED':
        return (
          <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        );
      case 'PENDING_REVIEW':
        return (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
            <Clock className="w-3 h-3 mr-1" />
            Pending Review
          </Badge>
        );
      case 'DRAFT':
        return <Badge variant="secondary">Draft</Badge>;
      case 'CANCELLED':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleExport = async () => {
    const res = await exportCompensationReportCSVAction({
      branchId: selectedBranchId,
      preset: selectedPreset as DateRangePreset,
      startDate,
      endDate,
      status: currentStatus === 'all' ? undefined : currentStatus,
      search: currentSearch || undefined,
    });
    if (!res.success || !res.csv) throw new Error(res.error || 'Failed to export CSV');
    return res.csv;
  };

  return (
    <ReportViewContainer
      title="Salary & Compensation Report"
      description="Confidential operational payroll statements, performance bonuses, incentives, and net payouts."
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
              placeholder="Search employee, record #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </form>

          <Select
            value={currentStatus}
            onValueChange={(val) => handleFilterChange('status', val)}
          >
            <SelectTrigger className="w-[160px] h-9 text-xs">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="PENDING_REVIEW">Pending Review</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
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
                  <TableHead className="font-semibold text-xs">Record #</TableHead>
                  <TableHead className="font-semibold text-xs">Employee</TableHead>
                  <TableHead className="font-semibold text-xs">Branch</TableHead>
                  <TableHead className="font-semibold text-xs">Period</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Base Salary</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Bonus</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Incentive</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Adjustment</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Gross</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Net Amount</TableHead>
                  <TableHead className="font-semibold text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="h-36 text-center text-muted-foreground text-sm">
                      No compensation records found matching the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs font-medium">
                        {row.salaryRecordNumber}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium text-foreground">{row.employeeName}</div>
                        <div className="text-[11px] text-muted-foreground">{row.employeeCode}</div>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-foreground">
                        {row.branchName}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {MONTHS[row.periodMonth - 1] || row.periodMonth} {row.periodYear}
                      </TableCell>
                      <TableCell className="text-xs text-right font-medium">
                        {formatCurrency(row.baseSalary)}
                      </TableCell>
                      <TableCell className="text-xs text-right font-medium text-purple-600 dark:text-purple-400">
                        {row.bonus > 0 ? formatCurrency(row.bonus) : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-right font-medium text-blue-600 dark:text-blue-400">
                        {row.incentive > 0 ? formatCurrency(row.incentive) : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-right font-medium">
                        {row.adjustment !== 0 ? (
                          <span className={row.adjustment > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                            {row.adjustment > 0 ? `+${formatCurrency(row.adjustment)}` : formatCurrency(row.adjustment)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-right font-medium">
                        {formatCurrency(row.grossAmount)}
                      </TableCell>
                      <TableCell className="text-xs text-right font-semibold text-foreground">
                        {formatCurrency(row.netAmount)}
                      </TableCell>
                      <TableCell className="text-xs">{getStatusBadge(row.status)}</TableCell>
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
