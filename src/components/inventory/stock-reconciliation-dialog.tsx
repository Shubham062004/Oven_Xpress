'use client';

import { useState, useTransition } from 'react';
import { Loader2, Scale, CheckCircle2, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';

import { recordStockReconciliation } from '@/lib/inventory/actions';
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

interface StockReconciliationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: { id: string; name: string; code: string }[];
  ingredients: { id: string; name: string; unit: IngredientUnit }[];
  defaultBranchId?: string;
  defaultIngredientId?: string;
  currentStockHint: number;
  onSuccess: () => void;
}

export function StockReconciliationDialog({
  open,
  onOpenChange,
  branches,
  ingredients,
  defaultBranchId,
  defaultIngredientId,
  currentStockHint,
  onSuccess,
}: StockReconciliationDialogProps) {
  const [isPending, startTransition] = useTransition();

  const [branchId, setBranchId] = useState(defaultBranchId || (branches[0]?.id ?? ''));
  const [ingredientId, setIngredientId] = useState(defaultIngredientId || (ingredients[0]?.id ?? ''));
  const [physicalCount, setPhysicalCount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      if (defaultBranchId) setBranchId(defaultBranchId);
      else if (branches.length > 0) setBranchId(branches[0].id);

      if (defaultIngredientId) setIngredientId(defaultIngredientId);
      else if (ingredients.length > 0) setIngredientId(ingredients[0].id);

      setPhysicalCount(currentStockHint !== undefined ? String(currentStockHint) : '');
      setReason('');
      setError(null);
    }
  }

  const selectedIngredient = ingredients.find((i) => i.id === ingredientId);

  const parsedPhysical = parseFloat(physicalCount);
  const isValidPhysical = !isNaN(parsedPhysical) && parsedPhysical >= 0;
  const variance = isValidPhysical ? Math.round((parsedPhysical - currentStockHint) * 1000) / 1000 : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidPhysical) {
      setError('Please enter a valid physical count (0 or greater)');
      return;
    }

    if (variance !== 0 && (!reason.trim() || reason.trim().length < 3)) {
      setError('Please provide an operational note explaining the discrepancy (min 3 characters)');
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await recordStockReconciliation({
        branchId,
        ingredientId,
        physicalCount: parsedPhysical,
        reason: reason.trim(),
      });

      if (!res.success) {
        setError(res.error || 'Failed to reconcile stock');
        toast.error(res.error || 'Failed to reconcile stock');
      } else {
        toast.success(res.data?.message || 'Stock reconciliation completed');
        onOpenChange(false);
        onSuccess();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Physical Stock Reconciliation</DialogTitle>
              <DialogDescription>
                Align system numbers with actual shelf counts. Discrepancies generate audited adjustments.
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rec-branch">Branch</Label>
              <Select
                value={branchId}
                onValueChange={(val) => {
                  if (val) setBranchId(val);
                }}
                disabled={isPending || branches.length <= 1}
              >
                <SelectTrigger id="rec-branch">
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
              <Label htmlFor="rec-ingredient">Ingredient</Label>
              <Select
                value={ingredientId}
                onValueChange={(val) => {
                  if (val) setIngredientId(val);
                }}
                disabled={isPending}
              >
                <SelectTrigger id="rec-ingredient">
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
          </div>

          {/* Counts Matrix */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-border bg-card/60">
            <div>
              <span className="text-[11px] text-muted-foreground uppercase font-semibold block">
                System Book Stock
              </span>
              <span className="font-mono text-base font-bold text-foreground">
                {currentStockHint} {selectedIngredient?.unit}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground uppercase font-semibold block">
                Calculated Variance
              </span>
              <span
                className={`font-mono text-base font-bold flex items-center gap-1 ${
                  variance > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : variance < 0
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                }`}
              >
                {variance > 0 && <TrendingUp className="h-4 w-4" />}
                {variance < 0 && <TrendingDown className="h-4 w-4" />}
                {variance === 0 && <CheckCircle2 className="h-4 w-4" />}
                {variance > 0 ? `+${variance}` : variance} {selectedIngredient?.unit}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rec-physical">
              Actual Physical Count on Shelf ({selectedIngredient?.unit})
            </Label>
            <Input
              id="rec-physical"
              type="number"
              step="0.001"
              min="0"
              placeholder="e.g. 18.5"
              value={physicalCount}
              onChange={(e) => setPhysicalCount(e.target.value)}
              disabled={isPending}
              required
            />
          </div>

          {variance !== 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="rec-reason">
                Discrepancy Explanation <span className="text-destructive">*</span>
              </Label>
              <Input
                id="rec-reason"
                placeholder={
                  variance > 0
                    ? 'e.g. Unrecorded extra supplier bonus or counting error'
                    : 'e.g. Unlogged minor kitchen spills / evaporation loss'
                }
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isPending}
                required
              />
            </div>
          )}

          {/* Variance Outcome Explanation */}
          {isValidPhysical && (
            <div
              className={`p-2.5 rounded-md border text-xs flex items-center justify-between font-medium ${
                variance > 0
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                  : variance < 0
                    ? 'bg-destructive/10 border-destructive/20 text-destructive'
                    : 'bg-muted/40 border-border text-muted-foreground'
              }`}
            >
              <span>Ledger Action:</span>
              <span className="font-semibold">
                {variance > 0 && `Creates ADJUSTMENT_IN (+${variance} ${selectedIngredient?.unit})`}
                {variance < 0 && `Creates ADJUSTMENT_OUT (-${Math.abs(variance)} ${selectedIngredient?.unit})`}
                {variance === 0 && 'No ledger adjustment needed (Count matches)'}
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
            <Button type="submit" disabled={isPending} className="gap-1.5 bg-purple-600 hover:bg-purple-700">
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Reconciling...
                </>
              ) : (
                'Save Reconciliation'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
