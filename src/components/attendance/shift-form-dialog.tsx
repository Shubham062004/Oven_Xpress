'use client';

import { useState, useTransition } from 'react';
import { Loader2, Clock, Moon } from 'lucide-react';
import { toast } from 'sonner';

import {
  createShift,
  updateShift,
  type ShiftItem,
} from '@/lib/attendance/actions';
import { shiftSchema } from '@/lib/validations/attendance';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

// ─── Props ──────────────────────────────────────────────────────────────────

interface BranchOption {
  id: string;
  name: string;
  code: string;
  city: string;
}

interface ShiftFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift?: ShiftItem | null;
  branches: BranchOption[];
  onSuccess: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function computeShiftDuration(startTime: string, endTime: string): { duration: string; isOvernight: boolean } {
  if (!startTime || !endTime) return { duration: '', isOvernight: false };

  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) {
    return { duration: '', isOvernight: false };
  }

  let totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
  let isOvernight = false;

  if (totalMinutes <= 0) {
    totalMinutes += 24 * 60;
    isOvernight = true;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  let duration = `${hours} hr${hours !== 1 ? 's' : ''}`;
  if (minutes > 0) {
    duration += ` ${minutes} min`;
  }

  return { duration, isOvernight };
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ShiftFormDialog({
  open,
  onOpenChange,
  shift,
  branches,
  onSuccess,
}: ShiftFormDialogProps) {
  const isEditing = !!shift;
  const [isPending, startTransition] = useTransition();

  const [formData, setFormData] = useState({
    name: shift?.name ?? '',
    branchId: shift?.branchId ?? (branches[0]?.id ?? ''),
    startTime: shift?.startTime ?? '09:00',
    endTime: shift?.endTime ?? '17:00',
    status: shift?.status ?? 'ACTIVE',
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Re-sync form state when shift or open changes
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setFormData({
        name: shift?.name ?? '',
        branchId: shift?.branchId ?? (branches[0]?.id ?? ''),
        startTime: shift?.startTime ?? '09:00',
        endTime: shift?.endTime ?? '17:00',
        status: shift?.status ?? 'ACTIVE',
      });
      setFieldErrors({});
      setFormError(null);
    }
    onOpenChange(newOpen);
  };

  const updateField = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (formError) setFormError(null);
  };

  const { duration, isOvernight } = computeShiftDuration(formData.startTime, formData.endTime);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = shiftSchema.safeParse(formData);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? '_form';
        if (!errors[key]) errors[key] = [];
        errors[key].push(issue.message);
      }
      setFieldErrors(errors);
      toast.error('Please resolve the validation errors.');
      return;
    }

    setFormError(null);

    startTransition(async () => {
      let result;
      if (isEditing && shift) {
        result = await updateShift(shift.id, formData);
      } else {
        result = await createShift(formData);
      }

      if (result.success) {
        toast.success(
          isEditing
            ? `Shift "${formData.name}" updated successfully.`
            : `Shift "${formData.name}" created successfully.`
        );
        onOpenChange(false);
        onSuccess();
      } else {
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
        setFormError(result.error ?? 'Failed to save shift.');
        toast.error(result.error ?? 'Failed to save shift.');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Shift' : 'Create New Shift'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the shift schedule or status for this branch.'
              : 'Define a work schedule for a restaurant branch.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {formError}
            </div>
          )}

          {/* Branch */}
          <div className="space-y-1.5">
            <Label htmlFor="shift-branch">
              Branch <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.branchId}
              onValueChange={(val) => updateField('branchId', val ?? '')}
            >
              <SelectTrigger id="shift-branch" className="w-full" disabled={isPending || branches.length <= 1}>
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

          {/* Shift Name */}
          <div className="space-y-1.5">
            <Label htmlFor="shift-name">
              Shift Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="shift-name"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g. Morning Shift, Evening Rush, Kitchen Shift"
              disabled={isPending}
              aria-invalid={!!fieldErrors.name}
            />
            {fieldErrors.name && (
              <p className="text-xs text-destructive">{fieldErrors.name[0]}</p>
            )}
          </div>

          {/* Start and End Times */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="shift-start">
                Start Time <span className="text-destructive">*</span>
              </Label>
              <Input
                id="shift-start"
                type="time"
                value={formData.startTime}
                onChange={(e) => updateField('startTime', e.target.value)}
                disabled={isPending}
                aria-invalid={!!fieldErrors.startTime}
              />
              {fieldErrors.startTime && (
                <p className="text-xs text-destructive">{fieldErrors.startTime[0]}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="shift-end">
                End Time <span className="text-destructive">*</span>
              </Label>
              <Input
                id="shift-end"
                type="time"
                value={formData.endTime}
                onChange={(e) => updateField('endTime', e.target.value)}
                disabled={isPending}
                aria-invalid={!!fieldErrors.endTime}
              />
              {fieldErrors.endTime && (
                <p className="text-xs text-destructive">{fieldErrors.endTime[0]}</p>
              )}
            </div>
          </div>

          {/* Duration info pill */}
          {duration && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {isOvernight ? (
                <Moon className="size-3.5 text-indigo-500 shrink-0" />
              ) : (
                <Clock className="size-3.5 text-primary shrink-0" />
              )}
              <span>
                Total Duration: <strong className="text-foreground">{duration}</strong>
                {isOvernight && ' (Overnight schedule ends on the next calendar day)'}
              </span>
            </div>
          )}

          {/* Status */}
          <div className="space-y-1.5">
            <Label htmlFor="shift-status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(val) => updateField('status', val ?? 'ACTIVE')}
            >
              <SelectTrigger id="shift-status" className="w-full" disabled={isPending}>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active (Available for assignment)</SelectItem>
                <SelectItem value="INACTIVE">Inactive (Disabled)</SelectItem>
              </SelectContent>
            </Select>
            {fieldErrors.status && (
              <p className="text-xs text-destructive">{fieldErrors.status[0]}</p>
            )}
          </div>

          <DialogFooter className="pt-2">
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
              {isEditing ? 'Save Changes' : 'Create Shift'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
