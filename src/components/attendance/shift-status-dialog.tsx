'use client';

import { useTransition } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { toggleShiftStatus, type ShiftItem } from '@/lib/attendance/actions';

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

interface ShiftStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift: ShiftItem;
  onSuccess: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ShiftStatusDialog({
  open,
  onOpenChange,
  shift,
  onSuccess,
}: ShiftStatusDialogProps) {
  const [isPending, startTransition] = useTransition();
  const isDeactivating = shift.status === 'ACTIVE';

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await toggleShiftStatus(shift.id);

      if (result.success) {
        toast.success(
          isDeactivating
            ? `Shift "${shift.name}" at ${shift.branch.name} has been deactivated.`
            : `Shift "${shift.name}" at ${shift.branch.name} has been reactivated.`
        );
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(result.error ?? 'Failed to update shift status.');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            {isDeactivating ? (
              <AlertTriangle className="size-5 text-amber-500" />
            ) : (
              <CheckCircle2 className="size-5 text-green-600" />
            )}
            <DialogTitle>
              {isDeactivating ? 'Deactivate Shift?' : 'Activate Shift?'}
            </DialogTitle>
          </div>
          <DialogDescription>
            {isDeactivating
              ? `Deactivating "${shift.name}" (${shift.startTime} - ${shift.endTime}) will hide it from new shift assignments and quick attendance recording. Existing attendance history remains completely intact.`
              : `Activating "${shift.name}" (${shift.startTime} - ${shift.endTime}) will make it available for employee scheduling at "${shift.branch.name}".`}
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
            {isDeactivating ? 'Deactivate Shift' : 'Activate Shift'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
