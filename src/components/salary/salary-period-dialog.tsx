'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  DollarSign,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';

import { SalaryRecordStatus, type SalaryType } from '@prisma/client';
import {
  previewSalaryRecord,
  createSalaryRecord,
  getActiveEmployeesForSelect,
} from '@/lib/salary/actions';
import { formatINR } from '@/lib/salary/constants';
import type { AttendancePeriodSummary, BonusItem, IncentiveItem } from '@/lib/salary/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SalaryPeriodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId?: string;
  onSuccess?: () => void;
}

export function SalaryPeriodDialog({
  open,
  onOpenChange,
  branchId,
  onSuccess,
}: SalaryPeriodDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form states
  const [employees, setEmployees] = useState<
    Array<{
      id: string;
      employeeCode: string;
      firstName: string;
      lastName: string;
      designation: string;
      branchId: string;
      branchName: string;
      salary: number;
      salaryType: SalaryType;
    }>
  >([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  
  // Default to current month range
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split('T')[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split('T')[0];

  const [periodStart, setPeriodStart] = useState(firstDay);
  const [periodEnd, setPeriodEnd] = useState(lastDay);
  const [adjustmentAmount, setAdjustmentAmount] = useState('0');
  const [notes, setNotes] = useState('');

  // Preview state
  const [isPreviewLoading, startPreviewTransition] = useTransition();
  const [previewData, setPreviewData] = useState<{
    baseSalary: number;
    bonusAmount: number;
    incentiveAmount: number;
    bonuses: BonusItem[];
    incentives: IncentiveItem[];
    attendanceSummary: AttendancePeriodSummary;
    salaryStructureId: string | null;
  } | null>(null);

  // Load employees when dialog opens
  useEffect(() => {
    if (open) {
      getActiveEmployeesForSelect(branchId).then((res) => {
        if (res.success && res.data) {
          setEmployees(res.data);
          if (res.data.length > 0 && !selectedEmployeeId) {
            setSelectedEmployeeId(res.data[0].id);
          }
        }
      });
    }
  }, [open, branchId, selectedEmployeeId]);

  // Trigger preview calculation when employee or dates change
  useEffect(() => {
    if (!open || !selectedEmployeeId || !periodStart || !periodEnd) return;

    if (new Date(periodEnd) < new Date(periodStart)) {
      return;
    }

    startPreviewTransition(async () => {
      const res = await previewSalaryRecord(
        selectedEmployeeId,
        new Date(periodStart),
        new Date(periodEnd)
      );
      if (res.success && res.data) {
        setPreviewData(res.data);
      } else {
        setPreviewData(null);
      }
    });
  }, [open, selectedEmployeeId, periodStart, periodEnd]);

  const numericAdjustment = parseFloat(adjustmentAmount) || 0;
  const grossCalculated =
    (previewData?.baseSalary || 0) +
    (previewData?.bonusAmount || 0) +
    (previewData?.incentiveAmount || 0) +
    numericAdjustment;

  const handleSubmit = (status: SalaryRecordStatus) => {
    if (!selectedEmployeeId) {
      toast.error('Please select an employee');
      return;
    }

    if (new Date(periodEnd) < new Date(periodStart)) {
      toast.error('Period end date must be on or after start date');
      return;
    }

    if (grossCalculated < 0) {
      toast.error('Calculated gross salary cannot be negative');
      return;
    }

    startTransition(async () => {
      const res = await createSalaryRecord({
        employeeId: selectedEmployeeId,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        adjustmentAmount: numericAdjustment,
        notes: notes.trim() || undefined,
        status:
          status === SalaryRecordStatus.DRAFT
            ? SalaryRecordStatus.DRAFT
            : SalaryRecordStatus.PENDING_REVIEW,
      });

      if (res.success && res.data) {
        toast.success(`Salary record ${res.data.salaryNumber} generated successfully!`);
        onOpenChange(false);
        if (onSuccess) onSuccess();
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to create salary period record');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Sparkles className="size-5 text-primary" />
            Create Salary Period Record
          </DialogTitle>
          <DialogDescription>
            Compute compensation ledger entry for an employee covering a defined calendar period.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Employee Picker */}
          <div className="space-y-2">
            <Label htmlFor="salary-employee" className="text-sm font-semibold">
              Select Employee
            </Label>
            <select
              id="salary-employee"
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} ({emp.employeeCode}) – {emp.designation} [{emp.branchName}]
                </option>
              ))}
            </select>
          </div>

          {/* Period Range */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="salary-period-start" className="text-sm font-semibold">
                Period Start
              </Label>
              <Input
                id="salary-period-start"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="salary-period-end" className="text-sm font-semibold">
                Period End
              </Label>
              <Input
                id="salary-period-end"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
          </div>

          {/* Real-time Calculation Breakdown Preview */}
          <div className="rounded-xl border bg-muted/40 p-4 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Compensation Breakdown
              </span>
              {isPreviewLoading && (
                <span className="text-xs text-muted-foreground animate-pulse">
                  Retrieving applicable rates...
                </span>
              )}
            </div>

            {previewData ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground">Base Salary (Historical Rate)</span>
                    <p className="font-semibold text-foreground">
                      {formatINR(previewData.baseSalary)}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Approved Bonuses ({previewData.bonuses.length})
                    </span>
                    <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                      +{formatINR(previewData.bonusAmount)}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Approved Incentives ({previewData.incentives.length})
                    </span>
                    <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                      +{formatINR(previewData.incentiveAmount)}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Adjustment</span>
                    <p className="font-semibold text-muted-foreground">
                      {numericAdjustment >= 0 ? '+' : ''}
                      {formatINR(numericAdjustment)}
                    </p>
                  </div>
                </div>

                {/* Informational Attendance Summary */}
                <div className="rounded-lg border border-border/80 bg-background/80 p-3 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <Clock className="size-3.5 text-primary" />
                      Attendance Record Summary
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      Informational Only
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div>
                      <span className="text-muted-foreground">Logged Days: </span>
                      <span className="font-medium">{previewData.attendanceSummary.totalWorkingDays}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Present: </span>
                      <span className="font-medium text-emerald-600">{previewData.attendanceSummary.present}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Absent: </span>
                      <span className="font-medium text-rose-600">{previewData.attendanceSummary.absent}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Half-Day: </span>
                      <span className="font-medium text-amber-600">{previewData.attendanceSummary.halfDay}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Leave: </span>
                      <span className="font-medium text-blue-600">{previewData.attendanceSummary.leave}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Late / Early: </span>
                      <span className="font-medium">
                        {previewData.attendanceSummary.lateArrivals} / {previewData.attendanceSummary.earlyDepartures}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground pt-1 italic flex items-center gap-1">
                    <Info className="size-3 text-muted-foreground shrink-0" />
                    Salary is not automatically deducted for absences or late arrivals.
                  </p>
                </div>

                {/* Total Gross Calculated */}
                <div className="flex items-center justify-between border-t pt-3">
                  <span className="text-sm font-bold">Calculated Gross Salary</span>
                  <span className="text-xl font-bold tracking-tight text-primary">
                    {formatINR(grossCalculated)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-muted-foreground">
                Select an employee and valid date range to preview calculated compensation.
              </div>
            )}
          </div>

          {/* Adjustment Input */}
          <div className="space-y-2">
            <Label htmlFor="salary-adjustment" className="text-sm font-semibold">
              Manual Adjustment (+ / -)
            </Label>
            <Input
              id="salary-adjustment"
              type="number"
              step="0.01"
              value={adjustmentAmount}
              onChange={(e) => setAdjustmentAmount(e.target.value)}
              placeholder="0.00 (e.g. +500 for overtime reimbursement, -200 for manual correction)"
            />
            <p className="text-xs text-muted-foreground">
              Optional authorized adjustment to gross amount. Enter negative values with a minus sign.
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="salary-notes" className="text-sm font-semibold">
              Notes & Justification
            </Label>
            <Textarea
              id="salary-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Operational notes, reference justification, or period details..."
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleSubmit(SalaryRecordStatus.DRAFT)}
            disabled={isPending || isPreviewLoading || !previewData}
          >
            Save as Draft
          </Button>
          <Button
            type="button"
            onClick={() => handleSubmit(SalaryRecordStatus.PENDING_REVIEW)}
            disabled={isPending || isPreviewLoading || !previewData}
          >
            {isPending ? 'Generating...' : 'Submit for Review'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
