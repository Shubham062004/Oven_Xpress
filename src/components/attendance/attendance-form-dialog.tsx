'use client';

import { useState, useTransition, useMemo } from 'react';
import { Loader2, AlertCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

import {
  markAttendance,
  updateAttendance,
  type AttendanceItem,
  type ShiftItem,
} from '@/lib/attendance/actions';
import { attendanceRecordSchema, attendanceUpdateSchema } from '@/lib/validations/attendance';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BranchOption {
  id: string;
  name: string;
  code: string;
  city: string;
}

export interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  designation: string;
  branchId: string;
  currentShiftId: string | null;
}

interface AttendanceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: AttendanceItem | null;
  defaultDate?: string;
  defaultBranchId?: string;
  branches: BranchOption[];
  employees: EmployeeOption[];
  shifts: ShiftItem[];
  onSuccess: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTimeOnly(date: Date | string | null): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatDateOnly(date: Date | string | null): string {
  if (!date) return new Date().toISOString().split('T')[0];
  const d = new Date(date);
  if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
  return d.toISOString().split('T')[0];
}

function computeLateAndEarlyPreview(
  dateStr: string,
  checkInTime: string,
  checkOutTime: string,
  shift: ShiftItem | null | undefined
): { lateMinutes: number; earlyDepartureMinutes: number } {
  let lateMinutes = 0;
  let earlyDepartureMinutes = 0;

  if (!shift || !dateStr) {
    return { lateMinutes, earlyDepartureMinutes };
  }

  // Calculate Late Arrival
  if (checkInTime) {
    const [startH, startM] = shift.startTime.split(':').map(Number);
    const [inH, inM] = checkInTime.split(':').map(Number);
    const shiftStartMins = startH * 60 + startM;
    const inMins = inH * 60 + inM;

    if (inMins > shiftStartMins) {
      lateMinutes = inMins - shiftStartMins;
    }
  }

  // Calculate Early Departure
  if (checkOutTime) {
    const [startH, startM] = shift.startTime.split(':').map(Number);
    const [endH, endM] = shift.endTime.split(':').map(Number);
    const [outH, outM] = checkOutTime.split(':').map(Number);

    let shiftEndMins = endH * 60 + endM;
    let outMins = outH * 60 + outM;

    // Overnight shift handling
    if (shift.endTime < shift.startTime) {
      shiftEndMins += 24 * 60;
      if (outMins < startH * 60 + startM) {
        outMins += 24 * 60;
      }
    }

    if (outMins < shiftEndMins) {
      earlyDepartureMinutes = shiftEndMins - outMins;
    }
  }

  return { lateMinutes, earlyDepartureMinutes };
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AttendanceFormDialog({
  open,
  onOpenChange,
  record,
  defaultDate,
  defaultBranchId,
  branches,
  employees,
  shifts,
  onSuccess,
}: AttendanceFormDialogProps) {
  const isEditing = !!record;
  const [isPending, startTransition] = useTransition();

  const initialBranchId =
    record?.branchId ??
    (defaultBranchId && defaultBranchId !== 'ALL'
      ? defaultBranchId
      : branches[0]?.id ?? '');

  const [branchId, setBranchId] = useState<string>(initialBranchId);
  const [employeeId, setEmployeeId] = useState<string>(record?.employeeId ?? '');
  const [shiftId, setShiftId] = useState<string>(record?.shiftId ?? 'NONE');
  const [date, setDate] = useState<string>(
    record ? formatDateOnly(record.date) : (defaultDate || new Date().toISOString().split('T')[0])
  );
  const [status, setStatus] = useState<string>(record?.status ?? 'PRESENT');
  const [checkInTime, setCheckInTime] = useState<string>(
    record?.checkIn ? formatTimeOnly(record.checkIn) : '09:00'
  );
  const [checkOutTime, setCheckOutTime] = useState<string>(
    record?.checkOut ? formatTimeOnly(record.checkOut) : '17:00'
  );
  const [note, setNote] = useState<string>(record?.note ?? '');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Sync state when dialog opens or record changes
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      const bId =
        record?.branchId ??
        (defaultBranchId && defaultBranchId !== 'ALL'
          ? defaultBranchId
          : branches[0]?.id ?? '');

      setBranchId(bId);
      setEmployeeId(record?.employeeId ?? '');
      setShiftId(record?.shiftId ?? 'NONE');
      setDate(
        record ? formatDateOnly(record.date) : (defaultDate || new Date().toISOString().split('T')[0])
      );
      setStatus(record?.status ?? 'PRESENT');
      setCheckInTime(record?.checkIn ? formatTimeOnly(record.checkIn) : '09:00');
      setCheckOutTime(record?.checkOut ? formatTimeOnly(record.checkOut) : '17:00');
      setNote(record?.note ?? '');
      setFieldErrors({});
      setFormError(null);
    }
    onOpenChange(newOpen);
  };

  // Branch-filtered employees
  const branchEmployees = useMemo(() => {
    return employees.filter((e) => e.branchId === branchId);
  }, [employees, branchId]);

  // Branch-filtered shifts
  const branchShifts = useMemo(() => {
    return shifts.filter((s) => s.branchId === branchId);
  }, [shifts, branchId]);

  // Handle employee selection in Create mode
  const handleEmployeeChange = (empId: string) => {
    setEmployeeId(empId);
    if (fieldErrors.employeeId) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.employeeId;
        return next;
      });
    }

    const selectedEmp = employees.find((e) => e.id === empId);
    if (selectedEmp?.currentShiftId) {
      setShiftId(selectedEmp.currentShiftId);
      const shiftObj = shifts.find((s) => s.id === selectedEmp.currentShiftId);
      if (shiftObj) {
        setCheckInTime(shiftObj.startTime);
        setCheckOutTime(shiftObj.endTime);
      }
    }
  };

  // Handle shift selection
  const handleShiftChange = (sId: string) => {
    setShiftId(sId);
    if (sId !== 'NONE') {
      const shiftObj = shifts.find((s) => s.id === sId);
      if (shiftObj) {
        setCheckInTime(shiftObj.startTime);
        setCheckOutTime(shiftObj.endTime);
      }
    }
  };

  // Selected shift object for preview
  const selectedShift = useMemo(() => {
    return shifts.find((s) => s.id === shiftId);
  }, [shifts, shiftId]);

  // Real-time calculation preview
  const { lateMinutes, earlyDepartureMinutes } = useMemo(() => {
    if (status !== 'PRESENT' && status !== 'HALF_DAY') {
      return { lateMinutes: 0, earlyDepartureMinutes: 0 };
    }
    return computeLateAndEarlyPreview(date, checkInTime, checkOutTime, selectedShift);
  }, [date, checkInTime, checkOutTime, selectedShift, status]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isEditing && !employeeId) {
      setFieldErrors({ employeeId: ['Please select an employee.'] });
      return;
    }

    const isPresentOrHalf = status === 'PRESENT' || status === 'HALF_DAY';

    if (isEditing && record) {
      const payload = {
        status,
        shiftId: shiftId === 'NONE' ? null : shiftId,
        checkInTime: isPresentOrHalf && checkInTime ? checkInTime : null,
        checkOutTime: isPresentOrHalf && checkOutTime ? checkOutTime : null,
        note: note.trim() || undefined,
      };

      const parsed = attendanceUpdateSchema.safeParse(payload);
      if (!parsed.success) {
        const errors: Record<string, string[]> = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path[0]?.toString() ?? '_form';
          if (!errors[key]) errors[key] = [];
          errors[key].push(issue.message);
        }
        setFieldErrors(errors);
        toast.error('Please fix validation errors.');
        return;
      }

      setFormError(null);

      startTransition(async () => {
        const result = await updateAttendance(record.id, payload);
        if (result.success) {
          toast.success(`Attendance updated for ${record.employee.firstName} ${record.employee.lastName}.`);
          onOpenChange(false);
          onSuccess();
        } else {
          if (result.fieldErrors) setFieldErrors(result.fieldErrors);
          setFormError(result.error ?? 'Failed to update attendance.');
          toast.error(result.error ?? 'Failed to update attendance.');
        }
      });
    } else {
      const payload = {
        employeeId,
        branchId,
        shiftId: shiftId === 'NONE' ? undefined : shiftId,
        date,
        status,
        checkInTime: isPresentOrHalf && checkInTime ? checkInTime : undefined,
        checkOutTime: isPresentOrHalf && checkOutTime ? checkOutTime : undefined,
        note: note.trim() || undefined,
      };

      const parsed = attendanceRecordSchema.safeParse(payload);
      if (!parsed.success) {
        const errors: Record<string, string[]> = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path[0]?.toString() ?? '_form';
          if (!errors[key]) errors[key] = [];
          errors[key].push(issue.message);
        }
        setFieldErrors(errors);
        toast.error('Please fix validation errors.');
        return;
      }

      setFormError(null);

      startTransition(async () => {
        const result = await markAttendance(payload);
        if (result.success) {
          toast.success(`Attendance recorded successfully.`);
          onOpenChange(false);
          onSuccess();
        } else {
          if (result.fieldErrors) setFieldErrors(result.fieldErrors);
          setFormError(result.error ?? 'Failed to record attendance.');
          toast.error(result.error ?? 'Failed to record attendance.');
        }
      });
    }
  };

  const isTimeApplicable = status === 'PRESENT' || status === 'HALF_DAY';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Correct Attendance Record' : 'Record Manual Attendance'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Correct clock times, status, or remarks for this employee record.'
              : 'Log daily attendance, check-in/out, half-day, or approved leave.'}
          </DialogDescription>
        </DialogHeader>

        {isEditing && record && (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
              {record.employee.firstName[0]}
              {record.employee.lastName[0]}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-foreground truncate">
                {record.employee.firstName} {record.employee.lastName}
              </div>
              <div className="text-xs text-muted-foreground">
                {record.employee.employeeCode} • {record.employee.designation} • {record.branch.name}
              </div>
            </div>
            <Badge variant="outline" className="shrink-0 font-mono text-xs">
              {formatDateOnly(record.date)}
            </Badge>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {formError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {!isEditing && (
            <>
              {/* Branch Select */}
              <div className="space-y-1.5">
                <Label htmlFor="att-branch">
                  Branch <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={branchId}
                  onValueChange={(val) => {
                    const newBranch = val ?? '';
                    setBranchId(newBranch);
                    setEmployeeId('');
                    setShiftId('NONE');
                  }}
                >
                  <SelectTrigger id="att-branch" className="w-full" disabled={isPending || branches.length <= 1}>
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name} ({b.city})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.branchId && (
                  <p className="text-xs text-destructive">{fieldErrors.branchId[0]}</p>
                )}
              </div>

              {/* Employee Select */}
              <div className="space-y-1.5">
                <Label htmlFor="att-employee">
                  Employee <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={employeeId}
                  onValueChange={(val) => handleEmployeeChange(val ?? '')}
                >
                  <SelectTrigger id="att-employee" className="w-full" disabled={isPending}>
                    <SelectValue placeholder={branchEmployees.length ? "Select employee" : "No employees in this branch"} />
                  </SelectTrigger>
                  <SelectContent>
                    {branchEmployees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.firstName} {e.lastName} ({e.employeeCode} - {e.designation})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.employeeId && (
                  <p className="text-xs text-destructive">{fieldErrors.employeeId[0]}</p>
                )}
              </div>

              {/* Date */}
              <div className="space-y-1.5">
                <Label htmlFor="att-date">
                  Working Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="att-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={isPending}
                  aria-invalid={!!fieldErrors.date}
                />
                {fieldErrors.date && (
                  <p className="text-xs text-destructive">{fieldErrors.date[0]}</p>
                )}
              </div>
            </>
          )}

          {/* Shift Select */}
          <div className="space-y-1.5">
            <Label htmlFor="att-shift">Assigned Shift</Label>
            <Select
              value={shiftId}
              onValueChange={(val) => handleShiftChange(val ?? 'NONE')}
            >
              <SelectTrigger id="att-shift" className="w-full" disabled={isPending}>
                <SelectValue placeholder="No specific shift (Optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">No specific shift</SelectItem>
                {branchShifts.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.startTime} - {s.endTime})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.shiftId && (
              <p className="text-xs text-destructive">{fieldErrors.shiftId[0]}</p>
            )}
          </div>

          {/* Attendance Status */}
          <div className="space-y-1.5">
            <Label htmlFor="att-status">
              Attendance Status <span className="text-destructive">*</span>
            </Label>
            <Select
              value={status}
              onValueChange={(val) => {
                setStatus(val ?? 'PRESENT');
              }}
            >
              <SelectTrigger id="att-status" className="w-full" disabled={isPending}>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PRESENT">Present (Full Day)</SelectItem>
                <SelectItem value="HALF_DAY">Half Day</SelectItem>
                <SelectItem value="ABSENT">Absent</SelectItem>
                <SelectItem value="LEAVE">Approved Leave</SelectItem>
              </SelectContent>
            </Select>
            {fieldErrors.status && (
              <p className="text-xs text-destructive">{fieldErrors.status[0]}</p>
            )}
          </div>

          {/* Check-In and Check-Out Times */}
          {isTimeApplicable && (
            <div className="rounded-lg border bg-card p-3.5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Clock className="size-3.5" />
                Working Hours
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="att-checkin" className="text-xs">Check-In Time</Label>
                  <Input
                    id="att-checkin"
                    type="time"
                    value={checkInTime}
                    onChange={(e) => setCheckInTime(e.target.value)}
                    disabled={isPending}
                    aria-invalid={!!fieldErrors.checkInTime}
                  />
                  {fieldErrors.checkInTime && (
                    <p className="text-xs text-destructive">{fieldErrors.checkInTime[0]}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="att-checkout" className="text-xs">Check-Out Time</Label>
                  <Input
                    id="att-checkout"
                    type="time"
                    value={checkOutTime}
                    onChange={(e) => setCheckOutTime(e.target.value)}
                    disabled={isPending}
                    aria-invalid={!!fieldErrors.checkOutTime}
                  />
                  {fieldErrors.checkOutTime && (
                    <p className="text-xs text-destructive">{fieldErrors.checkOutTime[0]}</p>
                  )}
                </div>
              </div>

              {/* Real-time automated calculation preview */}
              {selectedShift && (
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t text-xs">
                  <span className="text-muted-foreground">Shift: {selectedShift.startTime} - {selectedShift.endTime}</span>
                  {lateMinutes > 0 ? (
                    <Badge variant="destructive" className="font-mono text-[11px] py-0 px-1.5">
                      Late: +{lateMinutes}m
                    </Badge>
                  ) : checkInTime ? (
                    <Badge variant="outline" className="text-green-600 border-green-200 dark:border-green-900 font-mono text-[11px] py-0 px-1.5">
                      On Time
                    </Badge>
                  ) : null}

                  {earlyDepartureMinutes > 0 ? (
                    <Badge variant="destructive" className="bg-amber-600 hover:bg-amber-700 font-mono text-[11px] py-0 px-1.5">
                      Early Dept: -{earlyDepartureMinutes}m
                    </Badge>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {/* Notes / Reason */}
          <div className="space-y-1.5">
            <Label htmlFor="att-note">
              {status === 'LEAVE' ? 'Leave Reason / Remarks' : 'Notes / Remarks'}
            </Label>
            <Input
              id="att-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                status === 'LEAVE'
                  ? 'e.g. Medical leave, Prior approved casual leave'
                  : 'Optional operational note or explanation'
              }
              disabled={isPending}
            />
          </div>

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              {isEditing ? 'Save Correction' : 'Record Attendance'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
