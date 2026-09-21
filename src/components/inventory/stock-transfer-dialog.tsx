'use client';

import { useState, useTransition } from 'react';
import { Loader2, ArrowRightLeft, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

import { recordBranchTransfer } from '@/lib/inventory/actions';
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

interface StockTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: { id: string; name: string; code: string }[];
  ingredients: { id: string; name: string; unit: IngredientUnit }[];
  defaultSourceBranchId?: string;
  defaultIngredientId?: string;
  currentStockHint?: number;
  onSuccess: () => void;
}

export function StockTransferDialog({
  open,
  onOpenChange,
  branches,
  ingredients,
  defaultSourceBranchId,
  defaultIngredientId,
  currentStockHint,
  onSuccess,
}: StockTransferDialogProps) {
  const [isPending, startTransition] = useTransition();

  const [sourceBranchId, setSourceBranchId] = useState(
    defaultSourceBranchId || (branches[0]?.id ?? '')
  );
  const [destinationBranchId, setDestinationBranchId] = useState(
    branches.find((b) => b.id !== (defaultSourceBranchId || branches[0]?.id))?.id ?? ''
  );
  const [ingredientId, setIngredientId] = useState(defaultIngredientId || (ingredients[0]?.id ?? ''));
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      const srcId = defaultSourceBranchId || (branches[0]?.id ?? '');
      setSourceBranchId(srcId);
      const destId = branches.find((b) => b.id !== srcId)?.id ?? '';
      setDestinationBranchId(destId);

      if (defaultIngredientId) setIngredientId(defaultIngredientId);
      else if (ingredients.length > 0) setIngredientId(ingredients[0].id);

      setQuantity('');
      setNote('');
      setError(null);
    }
  }

  const selectedIngredient = ingredients.find((i) => i.id === ingredientId);
  const sourceBranch = branches.find((b) => b.id === sourceBranchId);
  const destBranch = branches.find((b) => b.id === destinationBranchId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numQty = parseFloat(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      setError('Please enter a valid positive quantity');
      return;
    }

    if (sourceBranchId === destinationBranchId) {
      setError('Source and destination branches must be different');
      return;
    }

    if (!destinationBranchId) {
      setError('Please select a destination branch');
      return;
    }

    if (currentStockHint !== undefined && numQty > currentStockHint) {
      setError(
        `Cannot transfer more than available stock at source (${currentStockHint} ${selectedIngredient?.unit || ''})`
      );
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await recordBranchTransfer({
        sourceBranchId,
        destinationBranchId,
        ingredientId,
        quantity: numQty,
        note,
      });

      if (!res.success) {
        setError(res.error || 'Failed to execute stock transfer');
        toast.error(res.error || 'Failed to execute stock transfer');
      } else {
        toast.success(
          `Transferred ${numQty} ${selectedIngredient?.unit || ''} from ${sourceBranch?.name} to ${destBranch?.name} (Ref: ${res.data?.referenceId})`
        );
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
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Branch Stock Transfer</DialogTitle>
              <DialogDescription>
                Move ingredients between branches with atomic linked transaction records.
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

          {/* Visual Route Flow */}
          <div className="p-3 rounded-lg border border-border bg-muted/30 flex items-center justify-between text-xs">
            <div className="text-center flex-1">
              <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                From (Source)
              </span>
              <span className="font-medium text-foreground truncate block">
                {sourceBranch?.name || 'Select Source'}
              </span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mx-2" />
            <div className="text-center flex-1">
              <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                To (Destination)
              </span>
              <span className="font-medium text-foreground truncate block">
                {destBranch?.name || 'Select Dest'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="trf-src">Source Branch</Label>
              <Select
                value={sourceBranchId}
                onValueChange={(val) => {
                  if (val) {
                    setSourceBranchId(val);
                    if (val === destinationBranchId) {
                      const alt = branches.find((b) => b.id !== val)?.id ?? '';
                      setDestinationBranchId(alt);
                    }
                  }
                }}
                disabled={isPending}
              >
                <SelectTrigger id="trf-src">
                  <SelectValue placeholder="Source Branch" />
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
              <Label htmlFor="trf-dest">Destination Branch</Label>
              <Select
                value={destinationBranchId}
                onValueChange={(val) => {
                  if (val) setDestinationBranchId(val);
                }}
                disabled={isPending}
              >
                <SelectTrigger id="trf-dest">
                  <SelectValue placeholder="Destination Branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches
                    .filter((b) => b.id !== sourceBranchId)
                    .map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="trf-ingredient">Ingredient</Label>
            <Select
              value={ingredientId}
              onValueChange={(val) => {
                if (val) setIngredientId(val);
              }}
              disabled={isPending}
            >
              <SelectTrigger id="trf-ingredient">
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
            <div className="flex items-center justify-between">
              <Label htmlFor="trf-qty">
                Transfer Quantity ({selectedIngredient?.unit})
              </Label>
              {currentStockHint !== undefined && selectedIngredient && (
                <span className="text-[11px] text-muted-foreground">
                  Source Stock: {currentStockHint} {selectedIngredient.unit}
                </span>
              )}
            </div>
            <Input
              id="trf-qty"
              type="number"
              step="0.001"
              min="0.001"
              placeholder="e.g. 10"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={isPending}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="trf-note">Transfer Note / Reason (Optional)</Label>
            <Input
              id="trf-note"
              placeholder="e.g. Inter-branch weekend stock sharing"
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
            <Button type="submit" disabled={isPending} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700">
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Transferring...
                </>
              ) : (
                <>
                  <ArrowRightLeft className="h-4 w-4" />
                  Execute Transfer
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
