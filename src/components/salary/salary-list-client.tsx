'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Banknote,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  TrendingUp,
  Gift,
  Eye,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { SalaryRecordStatus } from '@prisma/client';

import type {
  SalaryListItem,
  SalaryDashboardStats,
  PaginationMeta,
} from '@/lib/salary/types';
import {
  SALARY_RECORD_STATUS_META,
  formatINR,
  formatDateRange,
} from '@/lib/salary/constants';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { useAuth } from '@/providers/auth-provider';
import { hasPermission } from '@/lib/permissions/check';

import { PageHeader } from '@/components/ui/page-header';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { SalaryPeriodDialog } from '@/components/salary/salary-period-dialog';
import { SalaryRevisionDialog } from '@/components/salary/salary-revision-dialog';
import { BonusCreateDialog } from '@/components/salary/bonus-create-dialog';

interface SalaryListClientProps {
  initialRecords: SalaryListItem[];
  initialPagination: PaginationMeta;
  stats: SalaryDashboardStats;
  branches: Array<{ id: string; name: string; city: string }>;
  currentBranchId?: string;
  currentStatus?: SalaryRecordStatus;
  currentSearch?: string;
}

export function SalaryListClient({
  initialRecords,
  initialPagination,
  stats,
  branches,
  currentBranchId = '',
  currentStatus,
  currentSearch = '',
}: SalaryListClientProps) {
  const router = useRouter();
  const authUser = useAuth();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(currentSearch);
  const [branchFilter, setBranchFilter] = useState(currentBranchId);
  const [statusFilter, setStatusFilter] = useState<string>(currentStatus || '');

  // Dialog states
  const [isPeriodDialogOpen, setIsPeriodDialogOpen] = useState(false);
  const [isRevisionDialogOpen, setIsRevisionDialogOpen] = useState(false);
  const [isBonusDialogOpen, setIsBonusDialogOpen] = useState(false);

  const canCreateSalary = hasPermission(authUser, PERMISSIONS.SALARY_CREATE);
  const canCreateIncrement = hasPermission(authUser, PERMISSIONS.INCREMENT_CREATE);
  const canCreateBonus = hasPermission(authUser, PERMISSIONS.BONUS_CREATE);

  const applyFilters = (newBranch?: string, newStatus?: string, newSearch?: string) => {
    const params = new URLSearchParams();
    const b = newBranch !== undefined ? newBranch : branchFilter;
    const s = newStatus !== undefined ? newStatus : statusFilter;
    const q = newSearch !== undefined ? newSearch : search;

    if (b) params.set('branchId', b);
    if (s) params.set('status', s);
    if (q.trim()) params.set('search', q.trim());

    startTransition(() => {
      router.push(`/salary?${params.toString()}`);
    });
  };

  const resetFilters = () => {
    setSearch('');
    setBranchFilter('');
    setStatusFilter('');
    startTransition(() => {
      router.push('/salary');
    });
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams();
    if (branchFilter) params.set('branchId', branchFilter);
    if (statusFilter) params.set('status', statusFilter);
    if (search.trim()) params.set('search', search.trim());
    params.set('page', newPage.toString());

    startTransition(() => {
      router.push(`/salary?${params.toString()}`);
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Compensation & Salary Management"
        description="Employee salary ledger, period compensation review, bonuses, and increment revisions."
      >
        <div className="flex flex-wrap items-center gap-2">
          {canCreateIncrement && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRevisionDialogOpen(true)}
              className="gap-1.5"
            >
              <TrendingUp className="size-4" />
              Revise Salary
            </Button>
          )}

          {canCreateBonus && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBonusDialogOpen(true)}
              className="gap-1.5"
            >
              <Gift className="size-4" />
              Award Bonus
            </Button>
          )}

          {canCreateSalary && (
            <Button
              size="sm"
              onClick={() => setIsPeriodDialogOpen(true)}
              className="gap-1.5"
            >
              <Plus className="size-4" />
              New Salary Period
            </Button>
          )}
        </div>
      </PageHeader>

      {/* Navigation Sub-Links */}
      <div className="flex flex-wrap items-center gap-2 border-b pb-3">
        <Link
          href="/salary"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm"
        >
          <Banknote className="size-3.5" />
          Salary Records
        </Link>
        <Link
          href="/salary/increments"
          className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <TrendingUp className="size-3.5" />
          Increments & Revisions
        </Link>
        <Link
          href="/salary/bonuses"
          className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Gift className="size-3.5" />
          Bonuses & Incentives
        </Link>
      </div>

      {/* Dashboard Metrics Banner */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Active Employees
            </CardTitle>
            <Banknote className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">
              {stats.activeEmployeesWithSalary}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              With configured compensation
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Pending Reviews
            </CardTitle>
            <Clock className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {stats.pendingSalaryReviews}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Awaiting manager/owner review
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Approved Periods
            </CardTitle>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {stats.approvedSalaryRecords}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Approved & locked records
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Approved Bonuses
            </CardTitle>
            <Gift className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold tracking-tight truncate">
              {formatINR(stats.totalApprovedBonuses)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Total approved bonus volume
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 col-span-2 sm:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Recent Increments
            </CardTitle>
            <TrendingUp className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">
              {stats.recentIncrementsCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Revisions in past 90 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by employee name, code, or SAL number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyFilters(branchFilter, statusFilter, search);
                }}
                className="pl-9"
              />
            </div>

            {/* Branch Filter */}
            {branches.length > 1 && (
              <select
                value={branchFilter}
                onChange={(e) => {
                  setBranchFilter(e.target.value);
                  applyFilters(e.target.value, statusFilter, search);
                }}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.city})
                  </option>
                ))}
              </select>
            )}

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                applyFilters(branchFilter, e.target.value, search);
              }}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">All Statuses</option>
              {Object.entries(SALARY_RECORD_STATUS_META).map(([val, meta]) => (
                <option key={val} value={val}>
                  {meta.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyFilters(branchFilter, statusFilter, search)}
              disabled={isPending}
            >
              Filter
            </Button>
            {(branchFilter || statusFilter || search) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="text-muted-foreground gap-1"
              >
                <RotateCcw className="size-3.5" />
                Reset
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Records Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Salary #</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3 text-right">Base Salary</th>
                <th className="px-4 py-3 text-right">Bonus / Incentives</th>
                <th className="px-4 py-3 text-right">Adjustment</th>
                <th className="px-4 py-3 text-right">Gross Total</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {initialRecords.length > 0 ? (
                initialRecords.map((record) => {
                  const statusMeta =
                    SALARY_RECORD_STATUS_META[record.status] ||
                    SALARY_RECORD_STATUS_META.DRAFT;

                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">
                        <Link
                          href={`/salary/${record.id}`}
                          className="hover:text-primary hover:underline"
                        >
                          {record.salaryNumber}
                        </Link>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">
                          {record.employee.firstName} {record.employee.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {record.employee.employeeCode} • {record.employee.designation}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {record.branch.name}
                      </td>

                      <td className="px-4 py-3 text-xs">
                        {formatDateRange(record.periodStart, record.periodEnd)}
                      </td>

                      <td className="px-4 py-3 text-right font-medium text-foreground">
                        {formatINR(record.baseSalary)}
                      </td>

                      <td className="px-4 py-3 text-right text-xs">
                        {record.bonusAmount + record.incentiveAmount > 0 ? (
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            +{formatINR(record.bonusAmount + record.incentiveAmount)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">₹0</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right text-xs">
                        {record.adjustmentAmount !== 0 ? (
                          <span
                            className={
                              record.adjustmentAmount > 0
                                ? 'text-emerald-600 font-medium'
                                : 'text-rose-600 font-medium'
                            }
                          >
                            {record.adjustmentAmount > 0 ? '+' : ''}
                            {formatINR(record.adjustmentAmount)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">₹0</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right font-bold text-foreground">
                        {formatINR(record.grossAmount)}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant="outline"
                          className={`text-xs ${statusMeta.badgeClass}`}
                        >
                          {statusMeta.label}
                        </Badge>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/salary/${record.id}`}
                          className={buttonVariants({
                            variant: 'ghost',
                            size: 'sm',
                            className: 'h-8 gap-1 text-xs',
                          })}
                        >
                          <Eye className="size-3.5" />
                          Review
                        </Link>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted-foreground">
                    <Banknote className="mx-auto size-8 text-muted-foreground/40 mb-2" />
                    <p className="text-base font-semibold">No salary records found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {branchFilter || statusFilter || search
                        ? 'Try changing or clearing your search filters.'
                        : 'Create your first salary period record using the button above.'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {initialPagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
            <div>
              Showing {(initialPagination.page - 1) * initialPagination.pageSize + 1} to{' '}
              {Math.min(
                initialPagination.page * initialPagination.pageSize,
                initialPagination.totalItems
              )}{' '}
              of {initialPagination.totalItems} records
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(initialPagination.page - 1)}
                disabled={!initialPagination.hasPrevPage || isPending}
                className="h-8 gap-1 text-xs"
              >
                <ChevronLeft className="size-3.5" />
                Previous
              </Button>
              <span>
                Page {initialPagination.page} of {initialPagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(initialPagination.page + 1)}
                disabled={!initialPagination.hasNextPage || isPending}
                className="h-8 gap-1 text-xs"
              >
                Next
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Dialogs */}
      <SalaryPeriodDialog
        open={isPeriodDialogOpen}
        onOpenChange={setIsPeriodDialogOpen}
        branchId={branchFilter || undefined}
        onSuccess={() => router.refresh()}
      />

      <SalaryRevisionDialog
        open={isRevisionDialogOpen}
        onOpenChange={setIsRevisionDialogOpen}
        branchId={branchFilter || undefined}
        onSuccess={() => router.refresh()}
      />

      <BonusCreateDialog
        open={isBonusDialogOpen}
        onOpenChange={setIsBonusDialogOpen}
        branchId={branchFilter || undefined}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
