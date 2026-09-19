'use client';

import { useTransition } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface MenuStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  itemName: string;
  itemType: 'category' | 'ingredient' | 'item';
  currentStatus: 'ACTIVE' | 'INACTIVE';
  onConfirm: () => Promise<{ success: boolean; error?: string }>;
  onSuccess: () => void;
}

export function MenuStatusDialog({
  open,
  onOpenChange,
  title,
  itemName,
  itemType,
  currentStatus,
  onConfirm,
  onSuccess,
}: MenuStatusDialogProps) {
  const [isPending, startTransition] = useTransition();
  const isDeactivating = currentStatus === 'ACTIVE';

  const handleToggle = () => {
    startTransition(async () => {
      const res = await onConfirm();
      if (res.success) {
        toast.success(
          `${itemName} has been ${isDeactivating ? 'deactivated' : 'activated'} successfully.`
        );
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(res.error || 'Failed to update status. Please try again.');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !isPending && onOpenChange(val)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ${
                isDeactivating
                  ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                  : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
              }`}
            >
              {isDeactivating ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
            </div>
            <div>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription className="mt-1">
                Are you sure you want to {isDeactivating ? 'deactivate' : 'activate'}{' '}
                <span className="font-semibold text-foreground">{itemName}</span>?
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          {isDeactivating ? (
            itemType === 'category' ? (
              <p>
                Deactivating this category will hide it from customer-facing menus and new item creation.
                Existing menu items will remain intact and their historical data is preserved.
              </p>
            ) : itemType === 'ingredient' ? (
              <p>
                Deactivating this ingredient will prevent it from being selected in new recipes. Recipes
                currently referencing it will flag it as inactive. Historical consumption records are safe.
              </p>
            ) : (
              <p>
                Deactivating this item will immediately remove it from active ordering and branch operations.
                Its recipe BOM and sales history are safely preserved.
              </p>
            )
          ) : (
            <p>
              Activating this {itemType} will make it immediately available for operations, ordering, and recipes.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={isDeactivating ? 'destructive' : 'default'}
            disabled={isPending}
            onClick={handleToggle}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isDeactivating ? 'Deactivate' : 'Activate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
