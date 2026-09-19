'use client';

import { useTransition } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { toggleEmployeeStatus, type EmployeeItem } from '@/lib/employees/actions';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ─── Props ──────────────────────────────────────────────────────────────────

interface EmployeeStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: EmployeeItem;
  onSuccess: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function EmployeeStatusDialog({
  open,
  onOpenChange,
  employee,
  onSuccess,
}: EmployeeStatusDialogProps) {
  const [isPending, startTransition] = useTransition();
  const isDeactivating = employee.employmentStatus === 'ACTIVE';

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await toggleEmployeeStatus(employee.id);

      if (result.success) {
        toast.success(
          isDeactivating
            ? `Employee ${employee.firstName} ${employee.lastName} has been deactivated.`
            : `Employee ${employee.firstName} ${employee.lastName} has been reactivated.`
        );
        onSuccess();
      } else {
        toast.error(result.error ?? 'Failed to update employee status.');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            {isDeactivating ? (
              <AlertTriangle className="size-5 text-destructive" />
            ) : (
              <CheckCircle2 className="size-5 text-green-600" />
            )}
            <DialogTitle>
              {isDeactivating ? 'Deactivate Employee?' : 'Reactivate Employee?'}
            </DialogTitle>
          </div>
          <DialogDescription>
            {isDeactivating
              ? `Deactivating "${employee.firstName} ${employee.lastName} (${employee.employeeCode})" will mark their status as inactive while preserving all historical attendance and payroll data. Employees are never permanently deleted.`
              : `Reactivating "${employee.firstName} ${employee.lastName} (${employee.employeeCode})" will restore them to active employment status at "${employee.branch.name}".`}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant={isDeactivating ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
            {isDeactivating ? 'Deactivate' : 'Reactivate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
