'use client';

import { useState, useTransition, useEffect } from 'react';
import { Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import { recordWastageDamage } from '@/lib/inventory/actions';
import { WASTAGE_REASON_LABELS } from '@/lib/validations/inventory';
import { WastageReason, StockTransactionType, type IngredientUnit } from '@prisma/client';

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

interface WastageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: { id: string; name: string; code: string }[];
  ingredients: { id: string; name: string; unit: IngredientUnit }[];
  defaultBranchId?: string;
  defaultIngredientId?: string;
  currentStockHint?: number;
  onSuccess: () => void;
}

export function WastageDialog({
  open,
  onOpenChange,
  branches,
  ingredients,
  defaultBranchId,
  defaultIngredientId,
  currentStockHint,
  onSuccess,
}: WastageDialogProps) {
  const [isPending, startTransition] = useTransition();

  const [branchId, setBranchId] = useState(defaultBranchId || (branches[0]?.id ?? ''));
  const [ingredientId, setIngredientId] = useState(defaultIngredientId || (ingredients[0]?.id ?? ''));
  const [type, setType] = useState<StockTransactionType>(StockTransactionType.WASTAGE);
  const [reason, setReason] = useState<WastageReason>(WastageReason.SPOILED);
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (defaultBranchId) setBranchId(defaultBranchId);
      else if (branches.length > 0 && !branchId) setBranchId(branches[0].id);

      if (defaultIngredientId) setIngredientId(defaultIngredientId);
      else if (ingredients.length > 0 && !ingredientId) setIngredientId(ingredients[0].id);

      setType(StockTransactionType.WASTAGE);
      setReason(WastageReason.SPOILED);
      setQuantity('');
      setNote('');
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

    if (!branchId) {
      setError('Please select a branch');
      return;
    }

    if (!ingredientId) {
      setError('Please select an ingredient');
      return;
    }

    if (currentStockHint !== undefined && numQty > currentStockHint) {
      setError(`Quantity cannot exceed available stock (${currentStockHint} ${selectedIngredient?.unit || ''})`);
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await recordWastageDamage({
        branchId,
        ingredientId,
        type: type as 'DAMAGE' | 'WASTAGE',
        reason,
        quantity: numQty,
        note,
      });

      if (!res.success) {
        setError(res.error || 'Failed to record wastage/damage');
        toast.error(res.error || 'Failed to record wastage/damage');
      } else {
        toast.success(
          `Recorded ${type === 'DAMAGE' ? 'damage' : 'wastage'} of ${numQty} ${selectedIngredient?.unit || ''}`
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
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Record Wastage & Damage</DialogTitle>
              <DialogDescription>
                Log operational spoilage, kitchen waste, or physical ingredient damage.
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
              <Label htmlFor="waste-branch">Branch</Label>
              <Select
                value={branchId}
                onValueChange={(val) => {
                  if (val) setBranchId(val);
                }}
                disabled={isPending || branches.length <= 1}
              >
                <SelectTrigger id="waste-branch">
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
              <Label htmlFor="waste-type">Loss Type</Label>
              <Select
                value={type}
                onValueChange={(val) => {
                  if (val) setType(val as StockTransactionType);
                }}
                disabled={isPending}
              >
                <SelectTrigger id="waste-type">
                  <SelectValue placeholder="Select Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={StockTransactionType.WASTAGE}>Kitchen Wastage</SelectItem>
                  <SelectItem value={StockTransactionType.DAMAGE}>Physical Damage</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="waste-ingredient">Ingredient</Label>
            <Select
              value={ingredientId}
              onValueChange={(val) => {
                if (val) setIngredientId(val);
              }}
              disabled={isPending}
            >
              <SelectTrigger id="waste-ingredient">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="waste-qty">Quantity</Label>
                {currentStockHint !== undefined && selectedIngredient && (
                  <span className="text-[11px] text-muted-foreground">
                    In Stock: {currentStockHint} {selectedIngredient.unit}
                  </span>
                )}
              </div>
              <Input
                id="waste-qty"
                type="number"
                step="0.001"
                min="0.001"
                placeholder="e.g. 2.5"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={isPending}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="waste-reason">Loss Reason</Label>
              <Select
                value={reason}
                onValueChange={(val) => {
                  if (val) setReason(val as WastageReason);
                }}
                disabled={isPending}
              >
                <SelectTrigger id="waste-reason">
                  <SelectValue placeholder="Select Reason" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(WASTAGE_REASON_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="waste-note">Operational Note (Optional)</Label>
            <Input
              id="waste-note"
              placeholder="e.g. Discovered during morning fridge rotation"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={isPending}
            />
          </div>

          {/* Direction Callout */}
          {quantity && parseFloat(quantity) > 0 && selectedIngredient && (
            <div className="p-2.5 rounded-md bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center justify-between">
              <span>Effect on Stock:</span>
              <span className="font-bold text-sm">
                - {quantity} {selectedIngredient.unit}
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
            <Button type="submit" disabled={isPending} variant="destructive" className="gap-1.5">
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Record Loss
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
