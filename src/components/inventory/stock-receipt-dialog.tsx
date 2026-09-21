'use client';

import { useState, useTransition } from 'react';
import { Loader2, PlusCircle, ArrowDownToLine } from 'lucide-react';
import { toast } from 'sonner';

import { recordStockReceipt } from '@/lib/inventory/actions';
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

interface StockReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: { id: string; name: string; code: string }[];
  ingredients: { id: string; name: string; unit: IngredientUnit }[];
  defaultBranchId?: string;
  defaultIngredientId?: string;
  onSuccess: () => void;
}

export function StockReceiptDialog({
  open,
  onOpenChange,
  branches,
  ingredients,
  defaultBranchId,
  defaultIngredientId,
  onSuccess,
}: StockReceiptDialogProps) {
  const [isPending, startTransition] = useTransition();

  const [branchId, setBranchId] = useState(defaultBranchId || (branches[0]?.id ?? ''));
  const [ingredientId, setIngredientId] = useState(defaultIngredientId || (ingredients[0]?.id ?? ''));
  const [quantity, setQuantity] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      if (defaultBranchId) setBranchId(defaultBranchId);
      else if (branches.length > 0) setBranchId(branches[0].id);

      if (defaultIngredientId) setIngredientId(defaultIngredientId);
      else if (ingredients.length > 0) setIngredientId(ingredients[0].id);

      setQuantity('');
      setReferenceId('');
      setNote('');
      setError(null);
    }
  }

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

    setError(null);
    startTransition(async () => {
      const res = await recordStockReceipt({
        branchId,
        ingredientId,
        quantity: numQty,
        referenceId,
        note,
      });

      if (!res.success) {
        setError(res.error || 'Failed to record stock receipt');
        toast.error(res.error || 'Failed to record stock receipt');
      } else {
        toast.success(
          `Received ${numQty} ${selectedIngredient?.unit || ''} of ${selectedIngredient?.name}`
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
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ArrowDownToLine className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Receive Stock</DialogTitle>
              <DialogDescription>
                Record incoming raw materials or batch deliveries into branch stock.
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
            <Label htmlFor="receipt-branch">Destination Branch</Label>
            <Select
              value={branchId}
              onValueChange={(val) => {
                if (val) setBranchId(val);
              }}
              disabled={isPending || branches.length <= 1}
            >
              <SelectTrigger id="receipt-branch">
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
            <Label htmlFor="receipt-ingredient">Ingredient</Label>
            <Select
              value={ingredientId}
              onValueChange={(val) => {
                if (val) setIngredientId(val);
              }}
              disabled={isPending}
            >
              <SelectTrigger id="receipt-ingredient">
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
              <Label htmlFor="receipt-qty">
                Quantity <span className="text-muted-foreground">({selectedIngredient?.unit})</span>
              </Label>
              <Input
                id="receipt-qty"
                type="number"
                step="0.001"
                min="0.001"
                placeholder="e.g. 25"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={isPending}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="receipt-ref">Reference ID (Optional)</Label>
              <Input
                id="receipt-ref"
                placeholder="e.g. INV-1049, PO-88"
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="receipt-note">Operational Note (Optional)</Label>
            <Input
              id="receipt-note"
              placeholder="e.g. Morning produce delivery from central market"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={isPending}
            />
          </div>

          {/* Direction Callout */}
          {quantity && parseFloat(quantity) > 0 && selectedIngredient && (
            <div className="p-2.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
              <span>Effect on Stock:</span>
              <span className="font-bold text-sm">
                + {quantity} {selectedIngredient.unit}
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
            <Button type="submit" disabled={isPending} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <PlusCircle className="h-4 w-4" />
                  Receive Stock
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
