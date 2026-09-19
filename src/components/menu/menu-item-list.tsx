'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Search,
  Plus,
  Pencil,
  Power,
  UtensilsCrossed,
  Clock,
  Building2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

import type { MenuItemListItem, CategoryItem, MenuItemDetailItem } from '@/lib/menu/types';
import { toggleMenuItemStatus, getMenuItemById } from '@/lib/menu/item-actions';

import { Button, buttonVariants } from '@/components/ui/button';
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

import { MenuItemDialog } from '@/components/menu/menu-item-dialog';
import { MenuStatusDialog } from '@/components/menu/menu-status-dialog';

interface BranchOption {
  id: string;
  name: string;
  code: string;
}

interface MenuItemListProps {
  items: MenuItemListItem[];
  categories: CategoryItem[];
  branches: BranchOption[];
  canCreate: boolean;
  canUpdate: boolean;
  canDeactivate: boolean;
  onRefresh: () => void;
}

export function MenuItemList({
  items,
  categories,
  canCreate,
  canUpdate,
  canDeactivate,
  onRefresh,
}: MenuItemListProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modal dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDetail, setEditingDetail] = useState<MenuItemDetailItem | null>(null);

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [targetItem, setTargetItem] = useState<MenuItemListItem | null>(null);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        search.trim() === '' ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(search.toLowerCase()));

      const matchesCategory =
        categoryFilter === 'ALL' || item.categoryId === categoryFilter;

      const matchesStatus =
        statusFilter === 'ALL' || item.status === statusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [items, search, categoryFilter, statusFilter]);

  const handleOpenCreate = () => {
    setEditingDetail(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = async (item: MenuItemListItem) => {
    const res = await getMenuItemById(item.id);
    if (res.success && res.data) {
      setEditingDetail(res.data);
      setDialogOpen(true);
    }
  };

  const handleOpenStatusDialog = (item: MenuItemListItem) => {
    setTargetItem(item);
    setStatusDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Search & Filters Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search dishes & drinks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-sm"
            />
          </div>

          <Select
            value={categoryFilter}
            onValueChange={(val) => {
              if (val) setCategoryFilter(val);
            }}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(val) => {
              if (val) setStatusFilter(val as 'ALL' | 'ACTIVE' | 'INACTIVE');
            }}
          >
            <SelectTrigger className="w-full sm:w-32">
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
            New Menu Item
          </Button>
        )}
      </div>

      {/* Item List Display */}
      {filteredItems.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="No menu items found"
          description={
            search || categoryFilter !== 'ALL' || statusFilter !== 'ALL'
              ? 'Try modifying your search query or filters.'
              : 'Add your first menu item to begin serving dishes across your branches.'
          }
          action={
            canCreate && !search && categoryFilter === 'ALL' && statusFilter === 'ALL'
              ? {
                  label: 'Add Menu Item',
                  onClick: handleOpenCreate,
                }
              : undefined
          }
        />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden rounded-lg border border-border bg-card shadow-sm lg:block overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Menu Item</TableHead>
                  <TableHead className="w-36">Category</TableHead>
                  <TableHead className="w-28 text-right">Base Price</TableHead>
                  <TableHead className="w-28 text-center">Prep Time</TableHead>
                  <TableHead className="w-36 text-center">Recipe (BOM)</TableHead>
                  <TableHead className="w-32 text-center">Branches</TableHead>
                  <TableHead className="w-24 text-center">Status</TableHead>
                  <TableHead className="w-36 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell>
                      <div>
                        <Link
                          href={`/menu/items/${item.id}`}
                          className="font-semibold text-foreground hover:underline flex items-center gap-1.5 group"
                        >
                          {item.name}
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                        </Link>
                        {item.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {item.category.name}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right font-mono font-medium text-foreground">
                      ${item.price.toFixed(2)}
                    </TableCell>

                    <TableCell className="text-center text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {item.preparationTimeMinutes}m
                      </span>
                    </TableCell>

                    <TableCell className="text-center">
                      {item.recipeConfigured ? (
                        <Badge
                          variant="secondary"
                          className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-xs"
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          {item.ingredientCount} ing.
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-xs"
                        >
                          <AlertCircle className="mr-1 h-3 w-3" />
                          No BOM
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3" />
                        {item.availableBranchCount} active
                      </span>
                    </TableCell>

                    <TableCell className="text-center">
                      <Badge
                        variant={item.status === 'ACTIVE' ? 'default' : 'secondary'}
                        className={
                          item.status === 'ACTIVE'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                            : 'bg-muted text-muted-foreground'
                        }
                      >
                        {item.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/menu/items/${item.id}`}
                          className={buttonVariants({
                            variant: 'ghost',
                            size: 'sm',
                            className: 'h-8 px-2 text-xs',
                          })}
                        >
                          Details
                        </Link>
                        {canUpdate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(item)}
                            className="h-8 px-2 text-xs"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canDeactivate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenStatusDialog(item)}
                            className={`h-8 px-2 text-xs ${
                              item.status === 'ACTIVE'
                                ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400'
                                : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400'
                            }`}
                            title={item.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
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

          {/* Mobile / Tablet Cards */}
          <div className="grid grid-cols-1 gap-3 lg:hidden sm:grid-cols-2">
            {filteredItems.map((item) => (
              <Card key={item.id} className="p-4 border border-border shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link
                        href={`/menu/items/${item.id}`}
                        className="font-semibold text-foreground hover:underline line-clamp-1"
                      >
                        {item.name}
                      </Link>
                      <Badge variant="outline" className="mt-1 text-[10px]">
                        {item.category.name}
                      </Badge>
                    </div>
                    <span className="font-mono text-base font-bold text-foreground">
                      ${item.price.toFixed(2)}
                    </span>
                  </div>

                  {item.description && (
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                      {item.description}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {item.preparationTimeMinutes}m
                    </span>
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Building2 className="h-3 w-3" />
                      {item.availableBranchCount} branch(es)
                    </span>
                    {item.recipeConfigured ? (
                      <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600">
                        BOM: {item.ingredientCount} ing.
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-amber-600">
                        No Recipe
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-2.5">
                  <Badge
                    variant={item.status === 'ACTIVE' ? 'default' : 'secondary'}
                    className="text-[10px]"
                  >
                    {item.status}
                  </Badge>

                  <div className="flex items-center gap-1">
                    <Link
                      href={`/menu/items/${item.id}`}
                      className={buttonVariants({
                        variant: 'outline',
                        size: 'sm',
                        className: 'h-7 px-2.5 text-xs',
                      })}
                    >
                      Details
                    </Link>
                    {canUpdate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEdit(item)}
                        className="h-7 px-2 text-xs"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canDeactivate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenStatusDialog(item)}
                        className="h-7 px-2 text-xs"
                      >
                        <Power className="h-3.5 w-3.5" />
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
      <MenuItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={editingDetail}
        categories={categories}
        onSuccess={onRefresh}
      />

      {/* Status Confirmation Dialog */}
      {targetItem && (
        <MenuStatusDialog
          open={statusDialogOpen}
          onOpenChange={setStatusDialogOpen}
          title={targetItem.status === 'ACTIVE' ? 'Deactivate Menu Item' : 'Activate Menu Item'}
          itemName={targetItem.name}
          itemType="item"
          currentStatus={targetItem.status}
          onConfirm={() => toggleMenuItemStatus(targetItem.id)}
          onSuccess={onRefresh}
        />
      )}
    </div>
  );
}
