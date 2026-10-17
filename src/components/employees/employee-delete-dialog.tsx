'use client';

import { useTransition } from 'react';
import { AlertTriangle, Trash2, Loader2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

import { deleteEmployee, type EmployeeItem } from '@/lib/employees/actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface EmployeeDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: EmployeeItem;
  onSuccess: () => void;
}

export function EmployeeDeleteDialog({
  open,
  onOpenChange,
  employee,
  onSuccess,
}: EmployeeDeleteDialogProps) {
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await deleteEmployee(employee.id);

      if (result.success) {
        toast.success(
          result.message ||
            `Employee ${employee.firstName} ${employee.lastName} operation completed.`
        );
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(result.error ?? 'Failed to complete employee deletion.');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Trash2 className="size-5" />
            </div>
            <div>
              <DialogTitle>Delete Employee?</DialogTitle>
              <DialogDescription>
                Confirm action for <span className="font-semibold text-foreground">{employee.firstName} {employee.lastName}</span> ({employee.employeeCode})
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2 text-sm">
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            <ShieldAlert className="size-4 shrink-0 mt-0.5" />
            <p>
              To ensure compliance and audit integrity, employees with historical attendance, salary records, or operational data are <strong>safely deactivated</strong> rather than permanently erased.
            </p>
          </div>

          <p className="text-muted-foreground text-xs leading-relaxed">
            Are you sure you want to proceed? If this employee has no prior operational history, their record will be permanently deleted.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending}
            className="flex items-center gap-1.5"
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Confirm Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
