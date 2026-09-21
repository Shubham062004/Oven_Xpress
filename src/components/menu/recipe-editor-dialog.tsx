'use client';

import { useState, useTransition } from 'react';
import { Plus, Trash2, Loader2, AlertCircle, ScrollText } from 'lucide-react';
import { toast } from 'sonner';

import { saveRecipe } from '@/lib/menu/recipe-actions';
import {
  saveRecipeSchema,
  getCompatibleUnits,
  UNIT_LABELS,
} from '@/lib/validations/menu';
import type {
  IngredientItem,
  RecipeIngredientItem,
} from '@/lib/menu/types';
import type { IngredientUnit } from '@prisma/client';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface RecipeRow {
  ingredientId: string;
  quantity: number;
  unit: IngredientUnit;
  notes: string;
}

interface RecipeEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menuItemId: string;
  menuItemName: string;
  currentRecipe: RecipeIngredientItem[];
  availableIngredients: IngredientItem[];
  onSuccess: () => void;
}

export function RecipeEditorDialog({
  open,
  onOpenChange,
  menuItemId,
  menuItemName,
  currentRecipe,
  availableIngredients,
  onSuccess,
}: RecipeEditorDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [rows, setRows] = useState<RecipeRow[]>([]);

  // Active ingredients map
  const activeIngredients = availableIngredients.filter(
    (i) => i.status === 'ACTIVE'
  );

  const [prevRecipe, setPrevRecipe] = useState(currentRecipe);
  const [prevOpen, setPrevOpen] = useState(open);

  if (currentRecipe !== prevRecipe || open !== prevOpen) {
    setPrevRecipe(currentRecipe);
    setPrevOpen(open);
    if (open) {
      if (currentRecipe.length > 0) {
        setRows(
          currentRecipe.map((r) => ({
            ingredientId: r.ingredientId,
            quantity: r.quantity,
            unit: r.unit,
            notes: r.notes ?? '',
          }))
        );
      } else {
        setRows([]);
      }
      setFormError(null);
    }
  }

  const handleAddRow = () => {
    if (activeIngredients.length === 0) {
      toast.error('No active ingredients available. Please register ingredients first.');
      return;
    }

    // Pick first unused ingredient if possible
    const usedIds = new Set(rows.map((r) => r.ingredientId));
    const nextIng = activeIngredients.find((i) => !usedIds.has(i.id)) || activeIngredients[0];

    setRows((prev) => [
      ...prev,
      {
        ingredientId: nextIng.id,
        quantity: 1,
        unit: nextIng.unit,
        notes: '',
      },
    ]);
  };

  const handleRemoveRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleIngredientChange = (index: number, ingredientId: string) => {
    const ing = activeIngredients.find((i) => i.id === ingredientId);
    if (!ing) return;

    setRows((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        ingredientId,
        unit: ing.unit, // reset unit to default base unit
      };
      return next;
    });
  };

  const handleQuantityChange = (index: number, quantity: number) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], quantity };
      return next;
    });
  };

  const handleUnitChange = (index: number, unit: IngredientUnit) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], unit };
      return next;
    });
  };

  const handleNotesChange = (index: number, notes: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], notes };
      return next;
    });
  };

  const handleSave = () => {
    setFormError(null);

    // Client-side duplicate check
    const ingredientIds = rows.map((r) => r.ingredientId);
    if (new Set(ingredientIds).size !== ingredientIds.length) {
      setFormError('Duplicate ingredients detected. Each ingredient can only be added once.');
      return;
    }

    // Client-side positive quantity check
    for (const r of rows) {
      if (r.quantity <= 0 || isNaN(r.quantity)) {
        setFormError('Each ingredient quantity must be greater than zero.');
        return;
      }
    }

    const payload = {
      menuItemId,
      ingredients: rows,
    };

    const parsed = saveRecipeSchema.safeParse(payload);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message || 'Invalid recipe data.');
      return;
    }

    startTransition(async () => {
      const result = await saveRecipe(payload);
      if (result.success) {
        toast.success(`Recipe BOM for "${menuItemName}" saved successfully.`);
        onOpenChange(false);
        onSuccess();
      } else {
        setFormError(result.error || 'Failed to save recipe.');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !isPending && onOpenChange(val)}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-primary" />
            Recipe BOM Editor: {menuItemName}
          </DialogTitle>
          <DialogDescription>
            Configure the raw materials and proportional quantities required to produce this dish.
          </DialogDescription>
        </DialogHeader>

        {formError && (
          <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Scrollable BOM Rows */}
        <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1">
          {rows.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-border rounded-lg bg-muted/20">
              <ScrollText className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
              <p className="text-sm font-medium text-foreground">No ingredients in this recipe</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add the raw ingredients required to prepare this item.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddRow}
                className="mt-3 gap-1"
              >
                <Plus className="h-4 w-4" /> Add Ingredient
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((row, idx) => {
                const selectedIng = activeIngredients.find(
                  (i) => i.id === row.ingredientId
                );
                const compatibleUnits = selectedIng
                  ? getCompatibleUnits(selectedIng.unit)
                  : [row.unit];

                return (
                  <div
                    key={idx}
                    className="p-3 border border-border rounded-lg bg-card/60 shadow-2xs space-y-2"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                      {/* Ingredient Selector */}
                      <div className="sm:col-span-5 space-y-1">
                        <Label className="text-xs">Ingredient</Label>
                        <Select
                          value={row.ingredientId}
                          onValueChange={(val) => {
                            if (val) handleIngredientChange(idx, val);
                          }}
                          disabled={isPending}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select Ingredient" />
                          </SelectTrigger>
                          <SelectContent>
                            {activeIngredients.map((ing) => (
                              <SelectItem key={ing.id} value={ing.id}>
                                {ing.name} ({ing.unit})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Quantity */}
                      <div className="sm:col-span-3 space-y-1">
                        <Label className="text-xs">Quantity</Label>
                        <Input
                          type="number"
                          step="0.001"
                          min="0.001"
                          value={row.quantity || ''}
                          onChange={(e) =>
                            handleQuantityChange(idx, parseFloat(e.target.value) || 0)
                          }
                          className="h-8 text-xs font-mono"
                          disabled={isPending}
                        />
                      </div>

                      {/* Unit (Compatible Only) */}
                      <div className="sm:col-span-3 space-y-1">
                        <Label className="text-xs">Unit</Label>
                        <Select
                          value={row.unit}
                          onValueChange={(val) => {
                            if (val) handleUnitChange(idx, val as IngredientUnit);
                          }}
                          disabled={isPending}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Unit" />
                          </SelectTrigger>
                          <SelectContent>
                            {compatibleUnits.map((u) => (
                              <SelectItem key={u} value={u}>
                                {UNIT_LABELS[u] || u}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Remove Button */}
                      <div className="sm:col-span-1 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveRow(idx)}
                          disabled={isPending}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          title="Remove row"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Notes Row */}
                    <div>
                      <Input
                        placeholder="Optional prep note (e.g. finely chopped, room temperature, garnish)"
                        value={row.notes}
                        onChange={(e) => handleNotesChange(idx, e.target.value)}
                        className="h-7 text-xs text-muted-foreground placeholder:text-muted-foreground/60"
                        disabled={isPending}
                      />
                    </div>
                  </div>
                );
              })}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddRow}
                disabled={isPending}
                className="w-full gap-1.5 text-xs py-2 border-dashed"
              >
                <Plus className="h-4 w-4" />
                Add Another Ingredient
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border pt-3 gap-2 sm:gap-0">
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
            Save Recipe BOM
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
