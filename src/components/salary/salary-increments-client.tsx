'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  Banknote,
  Gift,
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import type { IncrementItem, PaginationMeta } from '@/lib/salary/types';
import { formatINR, formatDateShort } from '@/lib/salary/constants';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { useAuth } from '@/providers/auth-provider';
import { hasPermission } from '@/lib/permissions/check';

import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { SalaryRevisionDialog } from '@/components/salary/salary-revision-dialog';

interface SalaryIncrementsClientProps {
  initialIncrements: IncrementItem[];
  initialPagination: PaginationMeta;
  branches: Array<{ id: string; name: string; city: string }>;
  currentBranchId?: string;
  currentSearch?: string;
}

export function SalaryIncrementsClient({
  initialIncrements,
  initialPagination,
  branches,
  currentBranchId = '',
  currentSearch = '',
}: SalaryIncrementsClientProps) {
  const router = useRouter();
  const authUser = useAuth();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(currentSearch);
  const [branchFilter, setBranchFilter] = useState(currentBranchId);
  const [isRevisionDialogOpen, setIsRevisionDialogOpen] = useState(false);

  const canCreateIncrement = hasPermission(authUser, PERMISSIONS.INCREMENT_CREATE);

  const applyFilters = (newBranch?: string, newSearch?: string) => {
    const params = new URLSearchParams();
    const b = newBranch !== undefined ? newBranch : branchFilter;
    const q = newSearch !== undefined ? newSearch : search;

    if (b) params.set('branchId', b);
    if (q.trim()) params.set('search', q.trim());

    startTransition(() => {
      router.push(`/salary/increments?${params.toString()}`);
    });
  };

  const resetFilters = () => {
    setSearch('');
    setBranchFilter('');
    startTransition(() => {
      router.push('/salary/increments');
    });
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams();
    if (branchFilter) params.set('branchId', branchFilter);
    if (search.trim()) params.set('search', search.trim());
    params.set('page', newPage.toString());

    startTransition(() => {
      router.push(`/salary/increments?${params.toString()}`);
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Salary Increments & Revisions"
        description="Historical ledger of base compensation increments, appraisals, and structure adjustments."
      >
        {canCreateIncrement && (
          <Button
            size="sm"
            onClick={() => setIsRevisionDialogOpen(true)}
            className="gap-1.5"
          >
            <TrendingUp className="size-4" />
            Revise Salary
          </Button>
        )}
      </PageHeader>

      {/* Navigation Sub-Links */}
      <div className="flex flex-wrap items-center gap-2 border-b pb-3">
        <Link
          href="/salary"
          className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Banknote className="size-3.5" />
          Salary Records
        </Link>
        <Link
          href="/salary/increments"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm"
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

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search employee name or employee code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyFilters(branchFilter, search);
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
                  applyFilters(e.target.value, search);
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
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyFilters(branchFilter, search)}
              disabled={isPending}
            >
              Filter
            </Button>
            {(branchFilter || search) && (
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

      {/* Increments Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3 text-right">Previous Salary</th>
                <th className="px-4 py-3 text-right">New Salary</th>
                <th className="px-4 py-3 text-right">Increase Amount</th>
                <th className="px-4 py-3 text-center">Percentage</th>
                <th className="px-4 py-3">Effective Date</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Recorded By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {initialIncrements.length > 0 ? (
                initialIncrements.map((inc) => (
                  <tr key={inc.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        {inc.employee.firstName} {inc.employee.lastName}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {inc.employee.employeeCode} • {inc.employee.designation}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {inc.branch.name}
                    </td>

                    <td className="px-4 py-3 text-right font-medium text-muted-foreground">
                      {formatINR(inc.previousSalary)}
                    </td>

                    <td className="px-4 py-3 text-right font-bold text-foreground">
                      {formatINR(inc.newSalary)}
                    </td>

                    <td className="px-4 py-3 text-right text-xs">
                      <span
                        className={`font-semibold ${
                          inc.difference >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {inc.difference >= 0 ? '+' : ''}
                        {formatINR(inc.difference)}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center">
                      <Badge
                        variant="outline"
                        className={
                          inc.percentage >= 0
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-mono'
                            : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400 text-xs font-mono'
                        }
                      >
                        {inc.percentage >= 0 ? '+' : ''}
                        {inc.percentage}%
                      </Badge>
                    </td>

                    <td className="px-4 py-3 text-xs">
                      {formatDateShort(inc.effectiveDate)}
                    </td>

                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">
                      {inc.reason || 'Appraisal'}
                    </td>

                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {inc.createdBy}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground">
                    <TrendingUp className="mx-auto size-8 text-muted-foreground/40 mb-2" />
                    <p className="text-base font-semibold">No salary revisions recorded</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {branchFilter || search
                        ? 'Try changing your search filters.'
                        : 'Record your first salary increment revision using the button above.'}
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
              of {initialPagination.totalItems} increments
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

      {/* Revision Dialog */}
      <SalaryRevisionDialog
        open={isRevisionDialogOpen}
        onOpenChange={setIsRevisionDialogOpen}
        branchId={branchFilter || undefined}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
