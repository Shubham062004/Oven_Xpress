'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Layers,
  ArrowLeft,
  Plus,
  Search,
  Tag,
  Edit2,
  Power,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { ExpenseCategoryStatus } from '@prisma/client';

import type { ExpenseCategoryItem } from '@/lib/expenses/types';
import {
  createExpenseCategory,
  updateExpenseCategory,
  toggleExpenseCategoryStatus,
} from '@/lib/expenses/actions';
import { formatINR } from '@/lib/expenses/constants';
import { PERMISSIONS } from '@/lib/permissions/definitions';

import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ExpenseCategoriesClientProps {
  initialCategories: ExpenseCategoryItem[];
  userPermissions: string[];
}

export function ExpenseCategoriesClient({
  initialCategories,
  userPermissions,
}: ExpenseCategoriesClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategoryItem | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ExpenseCategoryStatus>(ExpenseCategoryStatus.ACTIVE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreate = userPermissions.includes(PERMISSIONS.EXPENSE_CATEGORY_CREATE);
  const canUpdate = userPermissions.includes(PERMISSIONS.EXPENSE_CATEGORY_UPDATE);
  const canDeactivate = userPermissions.includes(PERMISSIONS.EXPENSE_CATEGORY_DEACTIVATE);

  const openCreateDialog = () => {
    setEditingCategory(null);
    setName('');
    setDescription('');
    setStatus(ExpenseCategoryStatus.ACTIVE);
    setError(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (category: ExpenseCategoryItem) => {
    setEditingCategory(category);
    setName(category.name);
    setDescription(category.description || '');
    setStatus(category.status);
    setError(null);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name || name.trim().length < 2) {
      setError('Category name must be at least 2 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingCategory) {
        const res = await updateExpenseCategory(editingCategory.id, {
          name: name.trim().toUpperCase(),
          description: description.trim() || null,
          status,
        });

        if (res.success) {
          toast.success(`Category ${name.trim().toUpperCase()} updated!`);
          setIsDialogOpen(false);
          startTransition(() => {
            router.refresh();
          });
        } else {
          setError(res.error || 'Failed to update category');
        }
      } else {
        const res = await createExpenseCategory({
          name: name.trim().toUpperCase(),
          description: description.trim() || null,
          status,
        });

        if (res.success) {
          toast.success(`Category ${name.trim().toUpperCase()} created!`);
          setIsDialogOpen(false);
          startTransition(() => {
            router.refresh();
          });
        } else {
          setError(res.error || 'Failed to create category');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (cat: ExpenseCategoryItem) => {
    try {
      const res = await toggleExpenseCategoryStatus(cat.id);
      if (res.success) {
        toast.success(`Category ${cat.name} status updated.`);
        startTransition(() => {
          router.refresh();
        });
      } else {
        toast.error(res.error || 'Failed to change status');
      }
    } catch {
      toast.error('Unexpected error toggling status');
    }
  };

  const filteredCategories = initialCategories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Link
          href="/expenses"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Expenses</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <PageHeader
            title="Expense Categories"
            description="Manage expenditure accounting classifications and review total allocation by category."
          />
          {canCreate && (
            <Button size="sm" className="gap-1.5" onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              <span>Add Category</span>
            </Button>
          )}
        </div>
      </div>

      {/* Search Toolbar */}
      <Card className="border shadow-xs">
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search category name or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border shadow-xs">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[180px]">Category Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[120px] text-center">Status</TableHead>
                <TableHead className="w-[120px] text-center">Expenses Count</TableHead>
                <TableHead className="w-[140px] text-right">Total Recorded</TableHead>
                <TableHead className="w-[110px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCategories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                    No categories found matching your search.
                  </TableCell>
                </TableRow>
              ) : (
                filteredCategories.map((cat) => {
                  const isActive = cat.status === ExpenseCategoryStatus.ACTIVE;
                  return (
                    <TableRow key={cat.id}>
                      <TableCell className="font-semibold text-xs text-foreground">
                        <div className="flex items-center gap-1.5">
                          <Tag className="h-3.5 w-3.5 text-primary" />
                          <span>{cat.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {cat.description || '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] py-0.5 ${
                            isActive
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                              : 'bg-muted text-muted-foreground border-border'
                          }`}
                        >
                          {cat.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-xs font-medium">
                        {cat.expenseCount}
                      </TableCell>
                      <TableCell className="text-right text-xs font-bold text-foreground">
                        {formatINR(cat.totalAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canUpdate && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Edit Category"
                              onClick={() => openEditDialog(cat)}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {canDeactivate && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-7 w-7 ${
                                isActive ? 'text-muted-foreground hover:text-destructive' : 'text-emerald-600'
                              }`}
                              title={isActive ? 'Deactivate Category' : 'Activate Category'}
                              onClick={() => handleToggleStatus(cat)}
                            >
                              <Power className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle>
                  {editingCategory ? 'Edit Expense Category' : 'Create Expense Category'}
                </DialogTitle>
                <DialogDescription>
                  Configure accounting classification for branch operational expenses.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="categoryName" className="text-xs font-semibold text-muted-foreground">
                Category Code / Name *
              </Label>
              <Input
                id="categoryName"
                placeholder="e.g. PACKAGING, UTILITIES, MARKETING"
                value={name}
                onChange={(e) => setName(e.target.value.toUpperCase())}
                disabled={isSubmitting}
                className="font-mono text-xs uppercase"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="categoryDescription" className="text-xs font-semibold text-muted-foreground">
                Description / Purpose
              </Label>
              <Textarea
                id="categoryDescription"
                placeholder="Explain what expenses should be classified under this category..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
                className="text-xs min-h-20"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                {editingCategory ? 'Save Changes' : 'Create Category'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
