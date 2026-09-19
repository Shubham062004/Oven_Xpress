'use client';

import { useState, useTransition, useEffect } from 'react';
import { Loader2, SlidersHorizontal, Plus, Minus } from 'lucide-react';
import { toast } from 'sonner';

import { recordStockAdjustment } from '@/lib/inventory/actions';
import type { IngredientUnit } from '@prisma/client';

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

interface StockAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: { id: string; name: string; code: string }[];
  ingredients: { id: string; name: string; unit: IngredientUnit }[];
  defaultBranchId?: string;
  defaultIngredientId?: string;
  currentStockHint?: number;
  onSuccess: () => void;
}

export function StockAdjustmentDialog({
  open,
  onOpenChange,
  branches,
  ingredients,
  defaultBranchId,
  defaultIngredientId,
  currentStockHint,
  onSuccess,
}: StockAdjustmentDialogProps) {
  const [isPending, startTransition] = useTransition();

  const [branchId, setBranchId] = useState(defaultBranchId || (branches[0]?.id ?? ''));
  const [ingredientId, setIngredientId] = useState(defaultIngredientId || (ingredients[0]?.id ?? ''));
  const [direction, setDirection] = useState<'IN' | 'OUT'>('IN');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (defaultBranchId) setBranchId(defaultBranchId);
      else if (branches.length > 0 && !branchId) setBranchId(branches[0].id);

      if (defaultIngredientId) setIngredientId(defaultIngredientId);
      else if (ingredients.length > 0 && !ingredientId) setIngredientId(ingredients[0].id);

      setDirection('IN');
      setQuantity('');
      setReason('');
      setError(null);
    }
  }, [open, defaultBranchId, defaultIngredientId, branches, ingredients]);

  const selectedIngredient = ingredients.find((i) => i.id === ingredientId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numQty = parseFloat(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      setError('Please enter a valid positive quantity');
      return;
    }

    if (!reason.trim() || reason.trim().length < 3) {
      setError('Please provide an audit reason for the adjustment (min 3 characters)');
      return;
    }

    if (direction === 'OUT' && currentStockHint !== undefined && numQty > currentStockHint) {
      setError(
        `Cannot remove more than available stock (${currentStockHint} ${selectedIngredient?.unit || ''})`
      );
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await recordStockAdjustment({
        branchId,
        ingredientId,
        direction,
        quantity: numQty,
        reason: reason.trim(),
      });

      if (!res.success) {
        setError(res.error || 'Failed to record stock adjustment');
        toast.error(res.error || 'Failed to record stock adjustment');
      } else {
        toast.success(
          `Stock adjusted: ${direction === 'IN' ? '+' : '-'}${numQty} ${selectedIngredient?.unit || ''}`
        );
        onOpenChange(false);
        onSuccess();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Adjust Stock</DialogTitle>
              <DialogDescription>
                Correct inventory counts after a physical inspection or discrepancy review.
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

          <div className="space-y-1.5">
            <Label htmlFor="adj-branch">Branch</Label>
            <Select
              value={branchId}
              onValueChange={(val) => {
                if (val) setBranchId(val);
              }}
              disabled={isPending || branches.length <= 1}
            >
              <SelectTrigger id="adj-branch">
                <SelectValue placeholder="Select Branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adj-ingredient">Ingredient</Label>
            <Select
              value={ingredientId}
              onValueChange={(val) => {
                if (val) setIngredientId(val);
              }}
              disabled={isPending}
            >
              <SelectTrigger id="adj-ingredient">
                <SelectValue placeholder="Select Ingredient" />
              </SelectTrigger>
              <SelectContent>
                {ingredients.map((ing) => (
                  <SelectItem key={ing.id} value={ing.id}>
                    {ing.name} ({ing.unit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Direction Toggle */}
          <div className="space-y-1.5">
            <Label>Adjustment Direction</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDirection('IN')}
                className={`flex items-center justify-center gap-1.5 p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                  direction === 'IN'
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                    : 'bg-muted/40 border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                <Plus className="h-4 w-4" />
                ADD (Surplus / Inflow)
              </button>
              <button
                type="button"
                onClick={() => setDirection('OUT')}
                className={`flex items-center justify-center gap-1.5 p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                  direction === 'OUT'
                    ? 'bg-destructive/15 border-destructive/40 text-destructive'
                    : 'bg-muted/40 border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                <Minus className="h-4 w-4" />
                REMOVE (Deficit / Outflow)
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="adj-qty">
                Adjustment Quantity ({selectedIngredient?.unit})
              </Label>
              {currentStockHint !== undefined && selectedIngredient && (
                <span className="text-[11px] text-muted-foreground">
                  Current Stock: {currentStockHint} {selectedIngredient.unit}
                </span>
              )}
            </div>
            <Input
              id="adj-qty"
              type="number"
              step="0.001"
              min="0.001"
              placeholder="e.g. 5"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={isPending}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adj-reason">
              Audit Reason <span className="text-destructive">*</span>
            </Label>
            <Input
              id="adj-reason"
              placeholder="e.g. Monthly physical stock audit discrepancy"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isPending}
              required
            />
          </div>

          {/* Direction Callout */}
          {quantity && parseFloat(quantity) > 0 && selectedIngredient && (
            <div
              className={`p-2.5 rounded-md border text-xs flex items-center justify-between font-medium ${
                direction === 'IN'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                  : 'bg-destructive/10 border-destructive/20 text-destructive'
              }`}
            >
              <span>Net Adjustment:</span>
              <span className="font-bold text-sm">
                {direction === 'IN' ? '+' : '-'} {quantity} {selectedIngredient.unit}
              </span>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="gap-1.5">
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Adjustment'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
