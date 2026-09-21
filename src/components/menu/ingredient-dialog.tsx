'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { createIngredient, updateIngredient } from '@/lib/menu/ingredient-actions';
import {
  createIngredientSchema,
  ALL_UNITS,
  UNIT_LABELS,
  getUnitFamily,
} from '@/lib/validations/menu';
import type { IngredientItem } from '@/lib/menu/types';
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

interface IngredientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredient?: IngredientItem | null;
  onSuccess: () => void;
}

export function IngredientDialog({
  open,
  onOpenChange,
  ingredient,
  onSuccess,
}: IngredientDialogProps) {
  const isEditing = !!ingredient;
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    unit: 'KG' as IngredientUnit,
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  const [prevIngredient, setPrevIngredient] = useState<IngredientItem | null | undefined>(ingredient);
  const [prevOpen, setPrevOpen] = useState(open);

  if (ingredient !== prevIngredient || open !== prevOpen) {
    setPrevIngredient(ingredient);
    setPrevOpen(open);
    if (ingredient) {
      setFormData({
        name: ingredient.name,
        description: ingredient.description ?? '',
        unit: ingredient.unit,
        status: ingredient.status,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        unit: 'KG',
        status: 'ACTIVE',
      });
    }
    setFieldErrors({});
    setFormError(null);
  }

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const parsed = createIngredientSchema.safeParse(formData);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? '_form';
        if (!errors[key]) errors[key] = [];
        errors[key].push(issue.message);
      }
      setFieldErrors(errors);
      return;
    }

    startTransition(async () => {
      const result = isEditing
        ? await updateIngredient(ingredient.id, formData)
        : await createIngredient(formData);

      if (result.success) {
        toast.success(
          isEditing
            ? `Ingredient "${formData.name}" updated successfully.`
            : `Ingredient "${formData.name}" added successfully.`
        );
        onOpenChange(false);
        onSuccess();
      } else {
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
        setFormError(result.error ?? 'An unexpected error occurred.');
      }
    });
  };

  const unitFamily = getUnitFamily(formData.unit);

  return (
    <Dialog open={open} onOpenChange={(val) => !isPending && onOpenChange(val)}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Edit Ingredient' : 'New Raw Ingredient'}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Modify raw material details and base measurement unit.'
                : 'Register a raw ingredient used by recipes and kitchen preparation.'}
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="mt-3 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {formError}
            </div>
          )}

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="ingredient-name">
                Ingredient Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ingredient-name"
                placeholder="e.g. Mozzarella Cheese, Pizza Dough"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                disabled={isPending}
              />
              {fieldErrors.name && (
                <p className="text-xs text-destructive">{fieldErrors.name[0]}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ingredient-description">Description / Notes</Label>
              <Input
                id="ingredient-description"
                placeholder="Specification, brand, or quality grade"
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                disabled={isPending}
              />
              {fieldErrors.description && (
                <p className="text-xs text-destructive">
                  {fieldErrors.description[0]}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ingredient-unit">
                  Base Unit <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.unit}
                  onValueChange={(val) => {
                    if (val) updateField('unit', val);
                  }}
                  disabled={isPending}
                >
                  <SelectTrigger id="ingredient-unit">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {UNIT_LABELS[unit]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.unit && (
                  <p className="text-xs text-destructive">{fieldErrors.unit[0]}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ingredient-status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(val) => {
                    if (val) updateField('status', val);
                  }}
                  disabled={isPending}
                >
                  <SelectTrigger id="ingredient-status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Unit Family Helper Callout */}
            <div className="rounded-md border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Unit Family: </span>
              {unitFamily === 'MASS' && 'Mass / Weight (Compatible with KG and GRAM)'}
              {unitFamily === 'VOLUME' && 'Volume (Compatible with LITRE and ML)'}
              {unitFamily === 'COUNT' && 'Count (Compatible with PIECE, PACK, and DOZEN)'}
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
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Ingredient'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
