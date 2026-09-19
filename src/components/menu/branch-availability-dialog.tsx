'use client';

import { useState, useTransition, useEffect } from 'react';
import { Loader2, Building2, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

import { updateBranchAvailability } from '@/lib/menu/item-actions';
import type { BranchMenuItemItem } from '@/lib/menu/types';

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

interface BranchAvailabilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menuItemId: string;
  menuItemName: string;
  basePrice: number;
  branchRecord: BranchMenuItemItem;
  onSuccess: () => void;
}

export function BranchAvailabilityDialog({
  open,
  onOpenChange,
  menuItemId,
  menuItemName,
  basePrice,
  branchRecord,
  onSuccess,
}: BranchAvailabilityDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [isAvailable, setIsAvailable] = useState(branchRecord.isAvailable);
  const [customPrice, setCustomPrice] = useState<string>(
    branchRecord.price !== null ? String(branchRecord.price) : ''
  );
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setIsAvailable(branchRecord.isAvailable);
      setCustomPrice(branchRecord.price !== null ? String(branchRecord.price) : '');
      setFormError(null);
    }
  }, [open, branchRecord]);

  const handleSave = () => {
    setFormError(null);

    let priceValue: number | null = null;
    if (customPrice.trim() !== '') {
      priceValue = parseFloat(customPrice);
      if (isNaN(priceValue) || priceValue <= 0) {
        setFormError('Custom branch price must be a valid positive number.');
        return;
      }
    }

    startTransition(async () => {
      const result = await updateBranchAvailability({
        branchId: branchRecord.branchId,
        menuItemId,
        isAvailable,
        price: priceValue,
      });

      if (result.success) {
        toast.success(
          `Branch settings for ${branchRecord.branch.name} updated successfully.`
        );
        onOpenChange(false);
        onSuccess();
      } else {
        setFormError(result.error || 'Failed to update branch availability.');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !isPending && onOpenChange(val)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Branch Pricing: {branchRecord.branch.name}
          </DialogTitle>
          <DialogDescription>
            Configure availability and optional branch-specific pricing for{' '}
            <span className="font-semibold text-foreground">{menuItemName}</span>.
          </DialogDescription>
        </DialogHeader>

        {formError && (
          <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
            {formError}
          </div>
        )}

        <div className="space-y-4 py-3">
          {/* Base Price Display */}
          <div className="rounded-md border border-border bg-muted/40 p-3 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Global Base Price:</span>
            <span className="font-mono text-sm font-bold text-foreground">
              ${basePrice.toFixed(2)}
            </span>
          </div>

          {/* Availability Toggle */}
          <div className="flex items-center justify-between border-y border-border/60 py-3">
            <div>
              <Label className="text-sm font-semibold">Serve at this Branch</Label>
              <p className="text-xs text-muted-foreground">
                When turned off, customers at this branch cannot order this item.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isAvailable}
              onClick={() => setIsAvailable((prev) => !prev)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                isAvailable ? 'bg-primary' : 'bg-input'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out ${
                  isAvailable ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Custom Branch Price */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="branch-price">Branch-Specific Price ($)</Label>
              <span className="text-[11px] text-muted-foreground">
                Leave blank to use base price
              </span>
            </div>
            <div className="relative">
              <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="branch-price"
                type="number"
                step="0.01"
                min="0.01"
                placeholder={basePrice.toFixed(2)}
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                className="pl-8 text-sm font-mono"
                disabled={isPending || !isAvailable}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {customPrice.trim() !== ''
                ? `Custom branch price override of $${parseFloat(customPrice || '0').toFixed(2)} will be applied.`
                : `No override: standard base price of $${basePrice.toFixed(2)} will be charged.`}
            </p>
          </div>
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
          <Button type="button" onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Branch Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
