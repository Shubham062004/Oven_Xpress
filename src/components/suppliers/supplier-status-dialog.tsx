'use client';

import { useTransition } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { SupplierStatus } from '@prisma/client';
import type { SupplierListItem, SupplierDetail } from '@/lib/suppliers/types';
import { toggleSupplierStatus } from '@/lib/suppliers/actions';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SupplierStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: SupplierListItem | SupplierDetail;
  onSuccess: () => void;
}

export function SupplierStatusDialog({
  open,
  onOpenChange,
  supplier,
  onSuccess,
}: SupplierStatusDialogProps) {
  const [isPending, startTransition] = useTransition();
  const isDeactivating = supplier.status === SupplierStatus.ACTIVE;

  const handleConfirm = () => {
    startTransition(async () => {
      const nextStatus = isDeactivating ? SupplierStatus.INACTIVE : SupplierStatus.ACTIVE;
      const result = await toggleSupplierStatus(supplier.id, nextStatus);

      if (result.success) {
        toast.success(
          isDeactivating
            ? `Supplier "${supplier.name}" has been deactivated.`
            : `Supplier "${supplier.name}" has been reactivated.`
        );
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(result.error ?? 'Failed to update supplier status.');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {isDeactivating ? (
              <AlertTriangle className="size-5 text-destructive" />
            ) : (
              <CheckCircle2 className="size-5 text-green-600 dark:text-green-400" />
            )}
            <DialogTitle>
              {isDeactivating ? 'Deactivate Supplier?' : 'Reactivate Supplier?'}
            </DialogTitle>
          </div>
          <DialogDescription>
            {isDeactivating
              ? `Deactivating "${supplier.name}" will prevent creating new purchase orders with this vendor. All existing purchase orders, delivery logs, and inventory receipts will be preserved.`
              : `Reactivating "${supplier.name}" will make this supplier available for new purchase orders.`}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button
            type="button"
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
            {isDeactivating ? 'Deactivate Supplier' : 'Reactivate Supplier'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
