'use client';

import { useState, useTransition } from 'react';
import { Briefcase, Building2, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  assignBranchAndWork,
  type EmployeeItem,
  type BranchOption,
} from '@/lib/employees/actions';
import { APPROVED_DESIGNATIONS } from '@/lib/validations/employee';

import { Button } from '@/components/ui/button';
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

interface AssignBranchWorkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: EmployeeItem | null;
  branches: BranchOption[];
  onSuccess: () => void;
}

export function AssignBranchWorkDialog({
  open,
  onOpenChange,
  employee,
  branches,
  onSuccess,
}: AssignBranchWorkDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [prevEmployeeId, setPrevEmployeeId] = useState<string | undefined>(employee?.id);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => employee?.branchId || (branches[0]?.id ?? ''));
  const [selectedDesignation, setSelectedDesignation] = useState<string>(() =>
    employee?.designation && employee.designation !== 'Unassigned'
      ? employee.designation
      : 'Kitchen'
  );

  if (employee && employee.id !== prevEmployeeId) {
    setPrevEmployeeId(employee.id);
    setSelectedBranchId(employee.branchId || (branches[0]?.id ?? ''));
    setSelectedDesignation(
      employee.designation && employee.designation !== 'Unassigned'
        ? employee.designation
        : 'Kitchen'
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;

    if (!selectedBranchId) {
      toast.error('Please select an assigned branch.');
      return;
    }

    if (!selectedDesignation) {
      toast.error('Please select a job designation / work.');
      return;
    }

    startTransition(async () => {
      const res = await assignBranchAndWork({
        employeeId: employee.id,
        branchId: selectedBranchId,
        designation: selectedDesignation,
      });

      if (res.success) {
        toast.success(
          `Branch & Work assigned to ${employee.firstName} ${employee.lastName} successfully!`
        );
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(res.error || 'Failed to assign branch & work.');
      }
    });
  };

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Briefcase className="size-4.5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Assign Branch & Work
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Set restaurant branch and operational work role for this staff member.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Employee Summary Card */}
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3 flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">
              {employee.firstName} {employee.lastName}
            </p>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              {employee.employeeCode}
            </p>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-muted-foreground block">Current Work</span>
            <Badge variant="outline" className="text-xs font-normal mt-0.5">
              {employee.designation || 'Unassigned'}
            </Badge>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Branch Selection */}
          <div className="space-y-1.5">
            <Label htmlFor="branch" className="text-xs font-medium flex items-center gap-1.5">
              <Building2 className="size-3.5 text-muted-foreground" />
              Assigned Branch <span className="text-destructive">*</span>
            </Label>
            <Select value={selectedBranchId} onValueChange={(val) => setSelectedBranchId(val ?? '')}>
              <SelectTrigger id="branch" className="h-10 text-xs">
                <SelectValue placeholder="Select restaurant branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} ({b.city})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Branch where this employee is actively deployed.
            </p>
          </div>

          {/* Job Designation / Work Selection */}
          <div className="space-y-1.5">
            <Label htmlFor="designation" className="text-xs font-medium flex items-center gap-1.5">
              <Briefcase className="size-3.5 text-muted-foreground" />
              Job Designation / Work <span className="text-destructive">*</span>
            </Label>
            <Select value={selectedDesignation} onValueChange={(val) => setSelectedDesignation(val ?? '')}>
              <SelectTrigger id="designation" className="h-10 text-xs">
                <SelectValue placeholder="Select work designation" />
              </SelectTrigger>
              <SelectContent>
                {APPROVED_DESIGNATIONS.map((desig) => (
                  <SelectItem key={desig} value={desig}>
                    {desig}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Work role determining shifts, duties, and operational access.
            </p>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending || !selectedBranchId || !selectedDesignation}
              className="gap-1.5"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5" />
                  Save Assignment
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
