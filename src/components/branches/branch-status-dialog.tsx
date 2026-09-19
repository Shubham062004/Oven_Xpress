'use client';

import { useTransition } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Branch } from '@prisma/client';

import { toggleBranchStatus } from '@/lib/branches/actions';

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

interface BranchStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch: Branch;
  onSuccess: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function BranchStatusDialog({
  open,
  onOpenChange,
  branch,
  onSuccess,
}: BranchStatusDialogProps) {
  const [isPending, startTransition] = useTransition();
  const isDeactivating = branch.status === 'ACTIVE';

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await toggleBranchStatus(branch.id);

      if (result.success) {
        toast.success(
          isDeactivating
            ? `Branch "${branch.name}" has been deactivated.`
            : `Branch "${branch.name}" has been reactivated.`
        );
        onSuccess();
      } else {
        toast.error(result.error ?? 'Failed to update branch status.');
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
              <CheckCircle2 className="size-5 text-success" />
            )}
            <DialogTitle>
              {isDeactivating ? 'Deactivate Branch?' : 'Reactivate Branch?'}
            </DialogTitle>
          </div>
          <DialogDescription>
            {isDeactivating
              ? `Deactivating "${branch.name}" will prevent normal operational use (orders, attendance, etc.) while preserving all historical data. You can reactivate it at any time.`
              : `Reactivating "${branch.name}" will restore it to normal operational use.`}
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
