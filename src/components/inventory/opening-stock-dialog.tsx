'use client';

import { useState, useTransition, useEffect } from 'react';
import { Loader2, PackagePlus } from 'lucide-react';
import { toast } from 'sonner';

import { recordOpeningStock } from '@/lib/inventory/actions';
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

interface OpeningStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: { id: string; name: string; code: string }[];
  ingredients: { id: string; name: string; unit: IngredientUnit }[];
  defaultBranchId?: string;
  defaultIngredientId?: string;
  onSuccess: () => void;
}

export function OpeningStockDialog({
  open,
  onOpenChange,
  branches,
  ingredients,
  defaultBranchId,
  defaultIngredientId,
  onSuccess,
}: OpeningStockDialogProps) {
  const [isPending, startTransition] = useTransition();

  const [branchId, setBranchId] = useState(defaultBranchId || (branches[0]?.id ?? ''));
  const [ingredientId, setIngredientId] = useState(defaultIngredientId || (ingredients[0]?.id ?? ''));
  const [quantity, setQuantity] = useState('');
  const [minimumStock, setMinimumStock] = useState('5');
  const [reorderLevel, setReorderLevel] = useState('10');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (defaultBranchId) setBranchId(defaultBranchId);
      else if (branches.length > 0 && !branchId) setBranchId(branches[0].id);

      if (defaultIngredientId) setIngredientId(defaultIngredientId);
      else if (ingredients.length > 0 && !ingredientId) setIngredientId(ingredients[0].id);

      setQuantity('');
      setMinimumStock('5');
      setReorderLevel('10');
      setNote('');
      setError(null);
    }
  }, [open, defaultBranchId, defaultIngredientId, branches, ingredients]);

  const selectedIngredient = ingredients.find((i) => i.id === ingredientId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numQty = parseFloat(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      setError('Please enter a valid positive opening stock quantity');
      return;
    }

    const numMin = parseFloat(minimumStock) || 0;
    const numReorder = parseFloat(reorderLevel) || 0;

    if (numMin < 0 || numReorder < 0) {
      setError('Minimum stock and reorder level cannot be negative');
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await recordOpeningStock({
        branchId,
        ingredientId,
        quantity: numQty,
        minimumStock: numMin,
        reorderLevel: numReorder,
        note,
      });

      if (!res.success) {
        setError(res.error || 'Failed to initialize opening stock');
        toast.error(res.error || 'Failed to initialize opening stock');
      } else {
        toast.success(
          `Opening stock initialized: ${numQty} ${selectedIngredient?.unit || ''} for ${selectedIngredient?.name}`
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
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <PackagePlus className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Set Opening Stock</DialogTitle>
              <DialogDescription>
                Establish baseline stock for an ingredient when a branch commences operations.
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
            <Label htmlFor="open-branch">Branch</Label>
            <Select
              value={branchId}
              onValueChange={(val) => {
                if (val) setBranchId(val);
              }}
              disabled={isPending || branches.length <= 1}
            >
              <SelectTrigger id="open-branch">
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
            <Label htmlFor="open-ingredient">Ingredient</Label>
            <Select
              value={ingredientId}
              onValueChange={(val) => {
                if (val) setIngredientId(val);
              }}
              disabled={isPending}
            >
              <SelectTrigger id="open-ingredient">
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

          <div className="space-y-1.5">
            <Label htmlFor="open-qty">
              Initial Quantity ({selectedIngredient?.unit}) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="open-qty"
              type="number"
              step="0.001"
              min="0.001"
              placeholder="e.g. 50"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={isPending}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="open-min">Minimum Stock</Label>
              <Input
                id="open-min"
                type="number"
                step="0.001"
                min="0"
                value={minimumStock}
                onChange={(e) => setMinimumStock(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="open-reorder">Reorder Level</Label>
              <Input
                id="open-reorder"
                type="number"
                step="0.001"
                min="0"
                value={reorderLevel}
                onChange={(e) => setReorderLevel(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="open-note">Audit Note (Optional)</Label>
            <Input
              id="open-note"
              placeholder="e.g. Verified by head chef on branch launch"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={isPending}
            />
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
            <Button type="submit" disabled={isPending} className="gap-1.5">
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Set Opening Stock'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
