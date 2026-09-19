'use client';

import { useState, useTransition, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { createCategory, updateCategory } from '@/lib/menu/category-actions';
import { createCategorySchema } from '@/lib/validations/menu';
import type { CategoryItem } from '@/lib/menu/types';

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

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: CategoryItem | null;
  onSuccess: () => void;
}

export function CategoryDialog({
  open,
  onOpenChange,
  category,
  onSuccess,
}: CategoryDialogProps) {
  const isEditing = !!category;
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sortOrder: 0,
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name,
        description: category.description ?? '',
        sortOrder: category.sortOrder,
        status: category.status,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        sortOrder: 0,
        status: 'ACTIVE',
      });
    }
    setFieldErrors({});
    setFormError(null);
  }, [category, open]);

  const updateField = (field: string, value: string | number) => {
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

    // Client validation
    const parsed = createCategorySchema.safeParse(formData);
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
        ? await updateCategory(category.id, formData)
        : await createCategory(formData);

      if (result.success) {
        toast.success(
          isEditing
            ? `Category "${formData.name}" updated successfully.`
            : `Category "${formData.name}" created successfully.`
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

  return (
    <Dialog open={open} onOpenChange={(val) => !isPending && onOpenChange(val)}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Edit Category' : 'New Menu Category'}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Modify the category details below.'
                : 'Define a high-level grouping for your menu items (e.g. Pizzas, Beverages).'}
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="mt-3 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {formError}
            </div>
          )}

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="category-name">
                Category Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="category-name"
                placeholder="e.g. Artisanal Pizzas"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                disabled={isPending}
              />
              {fieldErrors.name && (
                <p className="text-xs text-destructive">{fieldErrors.name[0]}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="category-description">Description</Label>
              <Input
                id="category-description"
                placeholder="Optional description of this category"
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
                <Label htmlFor="category-sort">Display Sort Order</Label>
                <Input
                  id="category-sort"
                  type="number"
                  min={0}
                  value={formData.sortOrder}
                  onChange={(e) => updateField('sortOrder', parseInt(e.target.value) || 0)}
                  disabled={isPending}
                />
                {fieldErrors.sortOrder && (
                  <p className="text-xs text-destructive">{fieldErrors.sortOrder[0]}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="category-status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(val) => {
                    if (val) updateField('status', val);
                  }}
                  disabled={isPending}
                >
                  <SelectTrigger id="category-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
              {isEditing ? 'Save Changes' : 'Create Category'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
