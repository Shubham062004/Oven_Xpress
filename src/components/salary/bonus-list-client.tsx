'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Gift,
  TrendingUp,
  Banknote,
  Plus,
  Search,
  Building2,
  Calendar,
  RotateCcw,
  Check,
  X,
  Ban,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { BonusStatus, BonusType } from '@prisma/client';
import type { BonusItem, PaginationMeta } from '@/lib/salary/types';
import {
  BONUS_STATUS_META,
  BONUS_TYPE_LABELS,
  formatINR,
  formatDateShort,
} from '@/lib/salary/constants';
import { approveBonus, rejectBonus, cancelBonus } from '@/lib/salary/actions';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { useAuth } from '@/providers/auth-provider';
import { hasPermission } from '@/lib/permissions/check';

import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BonusCreateDialog } from '@/components/salary/bonus-create-dialog';

interface BonusListClientProps {
  initialBonuses: BonusItem[];
  initialPagination: PaginationMeta;
  branches: Array<{ id: string; name: string; city: string }>;
  currentBranchId?: string;
  currentStatus?: BonusStatus;
  currentSearch?: string;
}

export function BonusListClient({
  initialBonuses,
  initialPagination,
  branches,
  currentBranchId = '',
  currentStatus,
  currentSearch = '',
}: BonusListClientProps) {
  const router = useRouter();
  const authUser = useAuth();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(currentSearch);
  const [branchFilter, setBranchFilter] = useState(currentBranchId);
  const [statusFilter, setStatusFilter] = useState<string>(currentStatus || '');

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [rejectBonusId, setRejectBonusId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const canCreateBonus = hasPermission(authUser, PERMISSIONS.BONUS_CREATE);
  const canApproveBonus = hasPermission(authUser, PERMISSIONS.BONUS_APPROVE);
  const canCancelBonus = hasPermission(authUser, PERMISSIONS.BONUS_CANCEL);

  const applyFilters = (newBranch?: string, newStatus?: string, newSearch?: string) => {
    const params = new URLSearchParams();
    const b = newBranch !== undefined ? newBranch : branchFilter;
    const s = newStatus !== undefined ? newStatus : statusFilter;
    const q = newSearch !== undefined ? newSearch : search;

    if (b) params.set('branchId', b);
    if (s) params.set('status', s);
    if (q.trim()) params.set('search', q.trim());

    startTransition(() => {
      router.push(`/salary/bonuses?${params.toString()}`);
    });
  };

  const resetFilters = () => {
    setSearch('');
    setBranchFilter('');
    setStatusFilter('');
    startTransition(() => {
      router.push('/salary/bonuses');
    });
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams();
    if (branchFilter) params.set('branchId', branchFilter);
    if (statusFilter) params.set('status', statusFilter);
    if (search.trim()) params.set('search', search.trim());
    params.set('page', newPage.toString());

    startTransition(() => {
      router.push(`/salary/bonuses?${params.toString()}`);
    });
  };

  const handleApprove = (bonusId: string) => {
    startTransition(async () => {
      const res = await approveBonus({ bonusId });
      if (res.success) {
        toast.success('Bonus approved successfully');
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to approve bonus');
      }
    });
  };

  const handleRejectSubmit = () => {
    if (!rejectBonusId) return;
    if (!rejectReason.trim()) {
      toast.error('A rejection reason is required');
      return;
    }

    startTransition(async () => {
      const res = await rejectBonus({
        bonusId: rejectBonusId,
        reason: rejectReason.trim(),
      });
      if (res.success) {
        toast.success('Bonus marked as rejected');
        setRejectBonusId(null);
        setRejectReason('');
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to reject bonus');
      }
    });
  };

  const handleCancel = (bonusId: string) => {
    startTransition(async () => {
      const res = await cancelBonus({ bonusId });
      if (res.success) {
        toast.success('Bonus cancelled');
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to cancel bonus');
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Bonuses & Incentives Management"
        description="Award, verify, and approve performance bonuses and sales target incentives."
      >
        {canCreateBonus && (
          <Button
            size="sm"
            onClick={() => setIsCreateDialogOpen(true)}
            className="gap-1.5"
          >
            <Plus className="size-4" />
            Award Bonus
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
          className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <TrendingUp className="size-3.5" />
          Increments & Revisions
        </Link>
        <Link
          href="/salary/bonuses"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm"
        >
          <Gift className="size-3.5" />
          Bonuses & Incentives
        </Link>
      </div>

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by employee name or code..."
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
              {Object.entries(BONUS_STATUS_META).map(([val, meta]) => (
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

      {/* Bonuses Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Award Date</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {initialBonuses.length > 0 ? (
                initialBonuses.map((bonus) => {
                  const statusMeta =
                    BONUS_STATUS_META[bonus.status] ||
                    BONUS_STATUS_META.DRAFT;

                  return (
                    <tr key={bonus.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">
                          {bonus.employee.firstName} {bonus.employee.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {bonus.employee.employeeCode} • {bonus.employee.designation}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {bonus.branch.name}
                      </td>

                      <td className="px-4 py-3 text-xs">
                        <Badge variant="outline" className="font-normal">
                          {BONUS_TYPE_LABELS[bonus.type] || bonus.type}
                        </Badge>
                      </td>

                      <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        +{formatINR(bonus.amount)}
                      </td>

                      <td className="px-4 py-3 text-xs">
                        {formatDateShort(bonus.bonusDate)}
                      </td>

                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[220px]">
                        <div className="truncate">{bonus.reason}</div>
                        {bonus.rejectionReason && (
                          <div className="text-[11px] text-rose-600 dark:text-rose-400 italic truncate mt-0.5">
                            Rejection note: {bonus.rejectionReason}
                          </div>
                        )}
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
                        <div className="flex items-center justify-end gap-1">
                          {bonus.status === BonusStatus.PENDING_APPROVAL && canApproveBonus && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleApprove(bonus.id)}
                                disabled={isPending}
                                className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                title="Approve Bonus"
                              >
                                <Check className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setRejectBonusId(bonus.id);
                                  setRejectReason('');
                                }}
                                disabled={isPending}
                                className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                title="Reject Bonus"
                              >
                                <X className="size-4" />
                              </Button>
                            </>
                          )}

                          {(bonus.status === BonusStatus.DRAFT ||
                            bonus.status === BonusStatus.PENDING_APPROVAL) &&
                            canCancelBonus && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancel(bonus.id)}
                                disabled={isPending}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                title="Cancel Bonus"
                              >
                                <Ban className="size-3.5" />
                              </Button>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <Gift className="mx-auto size-8 text-muted-foreground/40 mb-2" />
                    <p className="text-base font-semibold">No bonus awards recorded</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {branchFilter || statusFilter || search
                        ? 'Try changing your search filters.'
                        : 'Award your first employee bonus or incentive using the button above.'}
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
              of {initialPagination.totalItems} awards
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

      {/* Create Dialog */}
      <BonusCreateDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        branchId={branchFilter || undefined}
        onSuccess={() => router.refresh()}
      />

      {/* Reject Modal with Mandatory Reason */}
      <Dialog open={!!rejectBonusId} onOpenChange={(o) => !o && setRejectBonusId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertCircle className="size-5 text-rose-600" />
              Reject Bonus Award
            </DialogTitle>
            <DialogDescription>
              A clear rejection reason is mandatory to reject this award. The award will remain historical in the ledger.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="reject-bonus-reason" className="text-xs font-semibold">
                Reason for Rejection
              </Label>
              <Textarea
                id="reject-bonus-reason"
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Specify reason for bonus denial (e.g. Ineligible under current policy, duplicate entry)..."
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectBonusId(null)}
              disabled={isPending}
            >
              Back
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectSubmit}
              disabled={isPending || !rejectReason.trim()}
            >
              {isPending ? 'Rejecting...' : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
