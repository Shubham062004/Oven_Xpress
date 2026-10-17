'use client';

import { useState, useTransition } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { BranchWithManager } from '@/lib/branches/actions';
import { deleteBranch } from '@/lib/branches/actions';

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

interface BranchDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch: BranchWithManager;
  onSuccess: (deletedId: string, updatedBranch?: BranchWithManager) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function BranchDeleteDialog({
  open,
  onOpenChange,
  branch,
  onSuccess,
}: BranchDeleteDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDelete = () => {
    setErrorMessage(null);
    startTransition(async () => {
      const result = await deleteBranch(branch.id);

      if (result.success) {
        toast.success(result.data?.message || `Branch "${branch.name}" updated successfully.`);
        onSuccess(branch.id, result.data?.branch);
        onOpenChange(false);
      } else {
        const error = result.error ?? 'Failed to delete branch.';
        setErrorMessage(error);
        toast.error(error);
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!isPending) {
          setErrorMessage(null);
          onOpenChange(val);
        }
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton={!isPending}>
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5 shrink-0" />
            <DialogTitle>Delete Branch</DialogTitle>
          </div>
          <DialogDescription className="space-y-2 pt-2 text-left text-sm text-muted-foreground">
            <p>
              Are you sure you want to delete{' '}
              <strong className="font-semibold text-foreground">{branch.name}</strong>{' '}
              (<span className="font-mono text-xs">{branch.code}</span>)?
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground/90">
              Deleting a branch may affect associated operational records. Historical orders,
              payments, inventory movements, attendance and audit records are strictly
              preserved for business integrity. Active branches with historical operations will
              be safely deactivated rather than permanently removed.
            </p>
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            {errorMessage}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
            id="confirm-delete-branch-button"
          >
            {isPending ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <Trash2 className="mr-1.5 size-4" />
            )}
            Delete Branch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
