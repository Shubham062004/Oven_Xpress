'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Clock,
  AlertCircle,
  Gift,
  ShieldCheck,
  Check,
  Ban,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

import { SalaryRecordStatus } from '@prisma/client';
import type { SalaryDetail } from '@/lib/salary/types';
import {
  SALARY_RECORD_STATUS_META,
  formatINR,
  formatDateShort,
  formatDateRange,
} from '@/lib/salary/constants';
import { approveSalaryRecord, cancelSalaryRecord } from '@/lib/salary/actions';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { useAuth } from '@/providers/auth-provider';
import { hasPermission } from '@/lib/permissions/check';

import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface SalaryDetailClientProps {
  record: SalaryDetail;
}

export function SalaryDetailClient({ record }: SalaryDetailClientProps) {
  const router = useRouter();
  const authUser = useAuth();
  const [isPending, startTransition] = useTransition();

  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const canApprove = hasPermission(authUser, PERMISSIONS.SALARY_APPROVE);
  const canCancel = hasPermission(authUser, PERMISSIONS.SALARY_CANCEL);

  const statusMeta =
    SALARY_RECORD_STATUS_META[record.status] ||
    SALARY_RECORD_STATUS_META.DRAFT;

  const isApproved = record.status === SalaryRecordStatus.APPROVED;
  const isCancelled = record.status === SalaryRecordStatus.CANCELLED;

  const handleApprove = () => {
    startTransition(async () => {
      const res = await approveSalaryRecord({ salaryRecordId: record.id });
      if (res.success) {
        toast.success(`Salary record ${record.salaryNumber} approved successfully`);
        setIsApproveDialogOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to approve salary record');
      }
    });
  };

  const handleCancel = () => {
    if (!cancelReason.trim()) {
      toast.error('Cancellation reason is required');
      return;
    }

    startTransition(async () => {
      const res = await cancelSalaryRecord({
        salaryRecordId: record.id,
        reason: cancelReason.trim(),
      });
      if (res.success) {
        toast.success(`Salary record ${record.salaryNumber} has been cancelled`);
        setIsCancelDialogOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to cancel salary record');
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Back Button & Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/salary"
          className={buttonVariants({
            variant: 'ghost',
            size: 'sm',
            className: 'gap-1.5 text-muted-foreground hover:text-foreground',
          })}
        >
          <ArrowLeft className="size-4" />
          Back to Salary Records
        </Link>

        <div className="flex items-center gap-2">
          {!isApproved && !isCancelled && canApprove && (
            <Button
              size="sm"
              onClick={() => setIsApproveDialogOpen(true)}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Check className="size-4" />
              Approve Record
            </Button>
          )}

          {!isCancelled && canCancel && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCancelDialogOpen(true)}
              className="gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20"
            >
              <Ban className="size-4" />
              Cancel Record
            </Button>
          )}
        </div>
      </div>

      {/* Header Banner */}
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl font-bold text-primary">
            <Banknote className="size-7" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {record.salaryNumber}
              </h1>
              <Badge variant="outline" className={statusMeta.badgeClass}>
                {statusMeta.label}
              </Badge>
              {isApproved && (
                <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 text-xs gap-1">
                  <ShieldCheck className="size-3" />
                  Financial Ledger Locked
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">
                {record.employee.firstName} {record.employee.lastName}
              </span>
              <span>•</span>
              <span className="font-mono text-xs">{record.employee.employeeCode}</span>
              <span>•</span>
              <span>{record.employee.designation}</span>
              <span>•</span>
              <span>{record.branch.name} ({record.branch.city})</span>
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs text-muted-foreground">Total Gross Compensation</span>
          <p className="text-3xl font-extrabold tracking-tight text-primary">
            {formatINR(record.grossAmount)}
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Card 1: Compensation Breakdown */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Banknote className="size-4 text-primary" />
              <CardTitle className="text-base">Financial Breakdown</CardTitle>
            </div>
            <CardDescription>
              Calculation components for period {formatDateRange(record.periodStart, record.periodEnd)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">Base Salary (Historical Rate)</span>
                <span className="font-semibold text-foreground">
                  {formatINR(record.baseSalary)}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">
                  Approved Bonus ({record.bonuses.length})
                </span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  +{formatINR(record.bonusAmount)}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">
                  Approved Incentive ({record.incentives.length})
                </span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  +{formatINR(record.incentiveAmount)}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">Manual Adjustment</span>
                <span
                  className={`font-semibold ${
                    record.adjustmentAmount >= 0 ? 'text-foreground' : 'text-rose-600'
                  }`}
                >
                  {record.adjustmentAmount >= 0 ? '+' : ''}
                  {formatINR(record.adjustmentAmount)}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 text-base font-bold">
                <span>Gross Payable</span>
                <span className="text-primary">{formatINR(record.grossAmount)}</span>
              </div>
            </div>

            {record.notes && (
              <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground border">
                <span className="font-semibold text-foreground">Notes: </span>
                {record.notes}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Informational Attendance Summary */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-primary" />
                <CardTitle className="text-base">Attendance Summary</CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px]">
                Informational Only
              </Badge>
            </div>
            <CardDescription>
              Operational shift & attendance record during this compensation period
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {record.attendanceSummary ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border bg-muted/20 p-2.5">
                    <span className="text-xs text-muted-foreground">Total Working Days</span>
                    <p className="text-lg font-bold">
                      {record.attendanceSummary.totalWorkingDays}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-emerald-500/10 p-2.5 border-emerald-500/20">
                    <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                      Days Present
                    </span>
                    <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                      {record.attendanceSummary.present}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-rose-500/10 p-2.5 border-rose-500/20">
                    <span className="text-xs text-rose-700 dark:text-rose-400 font-medium">
                      Days Absent
                    </span>
                    <p className="text-lg font-bold text-rose-700 dark:text-rose-400">
                      {record.attendanceSummary.absent}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-amber-500/10 p-2.5 border-amber-500/20">
                    <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                      Half Days / Leave
                    </span>
                    <p className="text-lg font-bold text-amber-700 dark:text-amber-400">
                      {record.attendanceSummary.halfDay} / {record.attendanceSummary.leave}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
                  <span>Late Arrivals: {record.attendanceSummary.lateArrivals}</span>
                  <span>Early Departures: {record.attendanceSummary.earlyDepartures}</span>
                </div>

                <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-2.5 text-[11px] text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="size-4 text-blue-500 shrink-0" />
                  <span>
                    Oven Xpress policy: Salary is not automatically deducted for attendance or absence without authorized approval.
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">
                No attendance records were logged during this period.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Card 3: Attached Bonuses and Incentives */}
      {(record.bonuses.length > 0 || record.incentives.length > 0) && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Gift className="size-4 text-primary" />
              <CardTitle className="text-base">Attached Bonuses & Incentives</CardTitle>
            </div>
            <CardDescription>
              Verified awards incorporated into this period gross calculation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border/60">
              {record.bonuses.map((b) => (
                <div key={b.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <span className="font-semibold text-foreground">{b.type}</span>
                    <p className="text-xs text-muted-foreground">{b.reason}</p>
                    <span className="text-[10px] text-muted-foreground">
                      Award Date: {formatDateShort(b.bonusDate)} • Recorded by {b.createdBy}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      +{formatINR(b.amount)}
                    </span>
                  </div>
                </div>
              ))}

              {record.incentives.map((i) => (
                <div key={i.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <span className="font-semibold text-foreground">Target / Sales Incentive</span>
                    <p className="text-xs text-muted-foreground">{i.reason}</p>
                    <span className="text-[10px] text-muted-foreground">
                      Award Date: {formatDateShort(i.incentiveDate)} • Recorded by {i.createdBy}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      +{formatINR(i.amount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Card 4: Audit Trail & Immutability */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            <CardTitle className="text-base">Approval & Audit Trail</CardTitle>
          </div>
          <CardDescription>
            Chronological audit log and authorized state progression
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-xs border-b pb-3">
            <div>
              <span className="text-muted-foreground">Created By:</span>
              <p className="font-medium text-foreground">{record.createdBy}</p>
              <span className="text-[10px] text-muted-foreground">
                {formatDateShort(record.createdAt)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Approval Status:</span>
              <p className="font-medium text-foreground">
                {record.approvedBy ? `Approved by ${record.approvedBy}` : 'Pending Review'}
              </p>
              {record.approvedAt && (
                <span className="text-[10px] text-muted-foreground">
                  {formatDateShort(record.approvedAt)}
                </span>
              )}
            </div>
          </div>

          {record.cancelledBy && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-700 dark:text-rose-400 space-y-1">
              <span className="font-semibold">Cancelled by {record.cancelledBy} on {formatDateShort(record.cancelledAt)}</span>
              <p>Reason: {record.cancellationReason || 'No reason provided'}</p>
            </div>
          )}

          {record.auditLogs.length > 0 && (
            <div className="space-y-2 pt-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Event Log
              </span>
              <div className="divide-y divide-border/40 text-xs">
                {record.auditLogs.map((log) => (
                  <div key={log.id} className="py-2 flex items-center justify-between">
                    <div>
                      <span className="font-medium text-foreground">{log.action}</span>
                      {log.notes && <p className="text-muted-foreground">{log.notes}</p>}
                    </div>
                    <div className="text-right text-muted-foreground">
                      <span>{log.performedBy}</span>
                      <p className="text-[10px]">{formatDateShort(log.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval Confirmation Dialog */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-emerald-600" />
              Approve Salary Record
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to approve salary record{' '}
              <strong>{record.salaryNumber}</strong> for{' '}
              <strong>{record.employee.firstName} {record.employee.lastName}</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-2 border">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gross Compensation:</span>
              <span className="font-bold text-foreground">{formatINR(record.grossAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Period:</span>
              <span>{formatDateRange(record.periodStart, record.periodEnd)}</span>
            </div>
            <p className="text-[11px] text-muted-foreground pt-1 border-t">
              Once approved, financial values are locked and become immutable for audit compliance.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsApproveDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isPending ? 'Approving...' : 'Confirm Approval'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancellation Dialog */}
      <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <Ban className="size-5 text-rose-600" />
              Cancel Salary Record
            </DialogTitle>
            <DialogDescription>
              Provide an official cancellation reason for record{' '}
              <strong>{record.salaryNumber}</strong>. Attached bonuses will be unlinked for future periods.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cancel-reason" className="text-xs font-semibold">
                Cancellation Justification
              </Label>
              <Textarea
                id="cancel-reason"
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for cancellation (e.g. Incorrect period dates entered, employee resigned)..."
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCancelDialogOpen(false)}
              disabled={isPending}
            >
              Back
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={isPending || !cancelReason.trim()}
            >
              {isPending ? 'Cancelling...' : 'Confirm Cancellation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
