'use client';

import { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Pencil,
  Power,
  Layers,
  UtensilsCrossed,
} from 'lucide-react';

import type { CategoryItem } from '@/lib/menu/types';
import { toggleCategoryStatus } from '@/lib/menu/category-actions';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';

import { CategoryDialog } from '@/components/menu/category-dialog';
import { MenuStatusDialog } from '@/components/menu/menu-status-dialog';

interface CategoryListProps {
  categories: CategoryItem[];
  canCreate: boolean;
  canUpdate: boolean;
  canDeactivate: boolean;
  onRefresh: () => void;
}

export function CategoryList({
  categories,
  canCreate,
  canUpdate,
  canDeactivate,
  onRefresh,
}: CategoryListProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [targetCategory, setTargetCategory] = useState<CategoryItem | null>(null);

  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      const matchesSearch =
        search.trim() === '' ||
        cat.name.toLowerCase().includes(search.toLowerCase()) ||
        (cat.description && cat.description.toLowerCase().includes(search.toLowerCase()));

      const matchesStatus =
        statusFilter === 'ALL' || cat.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [categories, search, statusFilter]);

  const handleOpenCreate = () => {
    setEditingCategory(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (cat: CategoryItem) => {
    setEditingCategory(cat);
    setDialogOpen(true);
  };

  const handleOpenStatusDialog = (cat: CategoryItem) => {
    setTargetCategory(cat);
    setStatusDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-sm"
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={(val) => {
              if (val) setStatusFilter(val as 'ALL' | 'ACTIVE' | 'INACTIVE');
            }}
          >
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {canCreate && (
          <Button onClick={handleOpenCreate} className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" />
            Add Category
          </Button>
        )}
      </div>

      {/* Content */}
      {filteredCategories.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No categories found"
          description={
            search || statusFilter !== 'ALL'
              ? 'Try adjusting your search query or status filter.'
              : 'Create your first menu category to start organizing your dishes.'
          }
          action={
            canCreate && !search && statusFilter === 'ALL'
              ? { label: 'Add Category', onClick: handleOpenCreate }
              : undefined
          }
        />
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden rounded-lg border border-border bg-card shadow-sm md:block overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-16 text-center">Sort</TableHead>
                  <TableHead>Category Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-28 text-center">Items</TableHead>
                  <TableHead className="w-28 text-center">Status</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCategories.map((cat) => (
                  <TableRow key={cat.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="text-center font-mono text-xs text-muted-foreground">
                      {cat.sortOrder}
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">
                      {cat.name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {cat.description || '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="font-mono text-xs">
                        <UtensilsCrossed className="mr-1 h-3 w-3" />
                        {cat._count?.items ?? 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={cat.status === 'ACTIVE' ? 'default' : 'secondary'}
                        className={
                          cat.status === 'ACTIVE'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                            : 'bg-muted text-muted-foreground'
                        }
                      >
                        {cat.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canUpdate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(cat)}
                            className="h-8 px-2 text-xs"
                            title="Edit Category"
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            Edit
                          </Button>
                        )}
                        {canDeactivate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenStatusDialog(cat)}
                            className={`h-8 px-2 text-xs ${
                              cat.status === 'ACTIVE'
                                ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400'
                                : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400'
                            }`}
                            title={cat.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                          >
                            <Power className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards View */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filteredCategories.map((cat) => (
              <Card key={cat.id} className="p-4 border border-border shadow-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{cat.name}</span>
                      <Badge
                        variant={cat.status === 'ACTIVE' ? 'default' : 'secondary'}
                        className="text-[10px] py-0 px-1.5"
                      >
                        {cat.status}
                      </Badge>
                    </div>
                    {cat.description && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {cat.description}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">
                    Order: {cat.sortOrder}
                  </Badge>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <UtensilsCrossed className="h-3.5 w-3.5" />
                    <span>{cat._count?.items ?? 0} item(s)</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {canUpdate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEdit(cat)}
                        className="h-7 px-2 text-xs"
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                    )}
                    {canDeactivate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenStatusDialog(cat)}
                        className="h-7 px-2 text-xs"
                      >
                        <Power className="h-3.5 w-3.5 mr-1" />
                        {cat.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Edit/Create Dialog */}
      <CategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={editingCategory}
        onSuccess={onRefresh}
      />

      {/* Status Confirmation Dialog */}
      {targetCategory && (
        <MenuStatusDialog
          open={statusDialogOpen}
          onOpenChange={setStatusDialogOpen}
          title={targetCategory.status === 'ACTIVE' ? 'Deactivate Category' : 'Activate Category'}
          itemName={targetCategory.name}
          itemType="category"
          currentStatus={targetCategory.status}
          onConfirm={() => toggleCategoryStatus(targetCategory.id)}
          onSuccess={onRefresh}
        />
      )}
    </div>
  );
}
