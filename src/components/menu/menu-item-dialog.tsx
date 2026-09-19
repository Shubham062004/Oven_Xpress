'use client';

import { useState, useTransition, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { createMenuItem, updateMenuItem } from '@/lib/menu/item-actions';
import { createMenuItemSchema } from '@/lib/validations/menu';
import type { CategoryItem, MenuItemDetailItem } from '@/lib/menu/types';

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

interface MenuItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: MenuItemDetailItem | null;
  categories: CategoryItem[];
  onSuccess: () => void;
}

export function MenuItemDialog({
  open,
  onOpenChange,
  item,
  categories,
  onSuccess,
}: MenuItemDialogProps) {
  const isEditing = !!item;
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    categoryId: '',
    price: 0,
    preparationTimeMinutes: 10,
    imageUrl: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name,
        description: item.description ?? '',
        categoryId: item.categoryId,
        price: item.price,
        preparationTimeMinutes: item.preparationTimeMinutes,
        imageUrl: item.imageUrl ?? '',
        status: item.status,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        categoryId: categories.length > 0 ? categories[0].id : '',
        price: 9.99,
        preparationTimeMinutes: 10,
        imageUrl: '',
        status: 'ACTIVE',
      });
    }
    setFieldErrors({});
    setFormError(null);
  }, [item, categories, open]);

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

    const parsed = createMenuItemSchema.safeParse(formData);
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
        ? await updateMenuItem(item.id, formData)
        : await createMenuItem(formData);

      if (result.success) {
        toast.success(
          isEditing
            ? `Menu item "${formData.name}" updated successfully.`
            : `Menu item "${formData.name}" created successfully.`
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
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Edit Menu Item' : 'New Menu Item'}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Update menu item specifications and baseline pricing.'
                : 'Create a new dish or beverage. Branch availability will be initialized automatically.'}
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="mt-3 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {formError}
            </div>
          )}

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="item-name">
                Item Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="item-name"
                placeholder="e.g. Margherita Stone Pizza"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                disabled={isPending}
              />
              {fieldErrors.name && (
                <p className="text-xs text-destructive">{fieldErrors.name[0]}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="item-category">
                Category <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.categoryId}
                onValueChange={(val) => {
                  if (val) updateField('categoryId', val);
                }}
                disabled={isPending || categories.length === 0}
              >
                <SelectTrigger id="item-category">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.categoryId && (
                <p className="text-xs text-destructive">{fieldErrors.categoryId[0]}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="item-price">
                  Base Price ($) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="item-price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="9.99"
                  value={formData.price || ''}
                  onChange={(e) => updateField('price', parseFloat(e.target.value) || 0)}
                  disabled={isPending}
                />
                {fieldErrors.price && (
                  <p className="text-xs text-destructive">{fieldErrors.price[0]}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="item-prep">Preparation Time (mins)</Label>
                <Input
                  id="item-prep"
                  type="number"
                  min="0"
                  max="720"
                  value={formData.preparationTimeMinutes}
                  onChange={(e) =>
                    updateField('preparationTimeMinutes', parseInt(e.target.value) || 0)
                  }
                  disabled={isPending}
                />
                {fieldErrors.preparationTimeMinutes && (
                  <p className="text-xs text-destructive">
                    {fieldErrors.preparationTimeMinutes[0]}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="item-desc">Description</Label>
              <Input
                id="item-desc"
                placeholder="Delicious description of ingredients, flavor, and texture"
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

            <div className="space-y-1.5">
              <Label htmlFor="item-status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(val) => {
                  if (val) updateField('status', val as 'ACTIVE' | 'INACTIVE');
                }}
                disabled={isPending}
              >
                <SelectTrigger id="item-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
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
              {isEditing ? 'Save Changes' : 'Create Item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
