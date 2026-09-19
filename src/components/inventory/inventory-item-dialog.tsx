'use client';

import { useState, useTransition, useEffect } from 'react';
import { Loader2, Settings2 } from 'lucide-react';
import { toast } from 'sonner';

import { updateInventoryItem } from '@/lib/inventory/actions';
import { InventoryStatus } from '@prisma/client';
import type { InventoryItemListItem } from '@/lib/inventory/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface InventoryItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItemListItem | null;
  onSuccess: () => void;
}

export function InventoryItemDialog({
  open,
  onOpenChange,
  item,
  onSuccess,
}: InventoryItemDialogProps) {
  const [isPending, startTransition] = useTransition();

  const [minimumStock, setMinimumStock] = useState('0');
  const [reorderLevel, setReorderLevel] = useState('0');
  const [status, setStatus] = useState<InventoryStatus>(InventoryStatus.ACTIVE);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && item) {
      setMinimumStock(String(item.minimumStock));
      setReorderLevel(String(item.reorderLevel));
      setStatus(item.status);
      setError(null);
    }
  }, [open, item]);

  if (!item) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numMin = parseFloat(minimumStock);
    const numReorder = parseFloat(reorderLevel);

    if (isNaN(numMin) || numMin < 0) {
      setError('Minimum stock must be a non-negative number');
      return;
    }

    if (isNaN(numReorder) || numReorder < 0) {
      setError('Reorder level must be a non-negative number');
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await updateInventoryItem(item.id, {
        minimumStock: numMin,
        reorderLevel: numReorder,
        status,
      });

      if (!res.success) {
        setError(res.error || 'Failed to update item configuration');
        toast.error(res.error || 'Failed to update item configuration');
      } else {
        toast.success(`Updated ${item.ingredientName} thresholds for ${item.branchName}`);
        onOpenChange(false);
        onSuccess();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Settings2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Configure Inventory Item</DialogTitle>
              <DialogDescription>
                {item.ingredientName} at {item.branchName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive font-medium">
              {error}
            </div>
          )}

          <div className="p-3 rounded-lg border border-border bg-card/60 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Stock:</span>
              <span className="font-semibold text-foreground">
                {item.currentStock} {item.unit}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Branch:</span>
              <span className="text-foreground">{item.branchName} ({item.branchCode})</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="item-min">Minimum Stock ({item.unit})</Label>
              <Input
                id="item-min"
                type="number"
                step="0.001"
                min="0"
                value={minimumStock}
                onChange={(e) => setMinimumStock(e.target.value)}
                disabled={isPending}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="item-reorder">Reorder Level ({item.unit})</Label>
              <Input
                id="item-reorder"
                type="number"
                step="0.001"
                min="0"
                value={reorderLevel}
                onChange={(e) => setReorderLevel(e.target.value)}
                disabled={isPending}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="item-status">Tracking Status</Label>
            <Select
              value={status}
              onValueChange={(val) => {
                if (val) setStatus(val as InventoryStatus);
              }}
              disabled={isPending}
            >
              <SelectTrigger id="item-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={InventoryStatus.ACTIVE}>Active</SelectItem>
                <SelectItem value={InventoryStatus.INACTIVE}>Inactive</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Deactivating preserves all historical stock transactions while hiding the item from active alerts.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
