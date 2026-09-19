'use client';

import { useState, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Pencil,
  Power,
  ScrollText,
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  Calendar,
} from 'lucide-react';

import type {
  MenuItemDetailItem,
  CategoryItem,
  IngredientItem,
  BranchMenuItemItem,
} from '@/lib/menu/types';
import { toggleMenuItemStatus } from '@/lib/menu/item-actions';
import { useAuth } from '@/providers/auth-provider';
import { hasPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';

import { Button, buttonVariants } from '@/components/ui/button';
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

import { MenuItemDialog } from '@/components/menu/menu-item-dialog';
import { RecipeEditorDialog } from '@/components/menu/recipe-editor-dialog';
import { BranchAvailabilityDialog } from '@/components/menu/branch-availability-dialog';
import { MenuStatusDialog } from '@/components/menu/menu-status-dialog';

interface MenuItemDetailClientProps {
  item: MenuItemDetailItem;
  categories: CategoryItem[];
  availableIngredients: IngredientItem[];
}

export function MenuItemDetailClient({
  item,
  categories,
  availableIngredients,
}: MenuItemDetailClientProps) {
  const router = useRouter();
  const user = useAuth();
  const [, startTransition] = useTransition();

  // Modals
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [recipeDialogOpen, setRecipeDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [selectedBranchRecord, setSelectedBranchRecord] = useState<BranchMenuItemItem | null>(null);

  // Permission checks
  const canUpdateItem = hasPermission(user, PERMISSIONS.MENU_ITEM_UPDATE);
  const canDeactivateItem = hasPermission(user, PERMISSIONS.MENU_ITEM_DEACTIVATE);
  const canUpdateRecipe = hasPermission(user, PERMISSIONS.MENU_RECIPE_UPDATE);
  const canUpdateBranch = hasPermission(user, PERMISSIONS.MENU_BRANCH_UPDATE);

  const handleRefresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  const handleOpenBranchDialog = (branchRecord: BranchMenuItemItem) => {
    setSelectedBranchRecord(branchRecord);
    setBranchDialogOpen(true);
  };

  const availableBranchesCount = item.branchAvailability.filter((b) => b.isAvailable).length;

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Link
            href="/menu"
            className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'h-8 px-2' })}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to Menu
          </Link>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {canUpdateRecipe && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRecipeDialogOpen(true)}
              className="gap-1.5"
            >
              <ScrollText className="h-4 w-4" />
              Manage Recipe BOM
            </Button>
          )}

          {canUpdateItem && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditDialogOpen(true)}
              className="gap-1.5"
            >
              <Pencil className="h-4 w-4" />
              Edit Item
            </Button>
          )}

          {canDeactivateItem && (
            <Button
              variant={item.status === 'ACTIVE' ? 'destructive' : 'default'}
              size="sm"
              onClick={() => setStatusDialogOpen(true)}
              className="gap-1.5"
            >
              <Power className="h-4 w-4" />
              {item.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
            </Button>
          )}
        </div>
      </div>

      {/* Main Item Headline Card */}
      <Card className="p-6 border border-border shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {item.name}
              </h1>
              <Badge variant="outline" className="text-xs">
                {item.category.name}
              </Badge>
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
            </div>
            {item.description && (
              <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
                {item.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-6 sm:border-l sm:border-border sm:pl-6">
            <div>
              <span className="text-xs text-muted-foreground uppercase font-medium">
                Base Price
              </span>
              <p className="font-mono text-2xl font-bold text-foreground">
                ${item.price.toFixed(2)}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground uppercase font-medium">
                Prep Time
              </span>
              <p className="font-mono text-2xl font-bold text-foreground flex items-center gap-1">
                <Clock className="h-5 w-5 text-muted-foreground" />
                {item.preparationTimeMinutes}m
              </p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Recipe / Bill of Materials (BOM) */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-5 border border-border shadow-xs">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <ScrollText className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-base text-foreground">
                    Bill of Materials (Recipe BOM)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Required raw ingredients and measured quantities per portion sold.
                  </p>
                </div>
              </div>

              {canUpdateRecipe && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRecipeDialogOpen(true)}
                  className="h-8 gap-1 text-xs"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit BOM
                </Button>
              )}
            </div>

            {item.recipeIngredients.length === 0 ? (
              <div className="py-10 text-center">
                <ScrollText className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
                <p className="text-sm font-medium text-foreground">No Recipe BOM Configured</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Configuring a recipe enables future inventory stock deduction and accurate ingredient consumption forecasting.
                </p>
                {canUpdateRecipe && (
                  <Button
                    size="sm"
                    onClick={() => setRecipeDialogOpen(true)}
                    className="mt-4 gap-1 text-xs"
                  >
                    <ScrollText className="h-3.5 w-3.5" /> Configure Recipe Now
                  </Button>
                )}
              </div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Ingredient</TableHead>
                      <TableHead className="w-32 text-right">Quantity</TableHead>
                      <TableHead className="w-24">Unit</TableHead>
                      <TableHead>Preparation Note</TableHead>
                      <TableHead className="w-24 text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {item.recipeIngredients.map((r) => (
                      <TableRow key={r.id} className="hover:bg-muted/20">
                        <TableCell className="font-medium text-foreground">
                          {r.ingredient.name}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold">
                          {r.quantity}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">
                            {r.unit}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.notes || '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={r.ingredient.status === 'ACTIVE' ? 'default' : 'secondary'}
                            className="text-[10px]"
                          >
                            {r.ingredient.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>

          {/* Branch Availability Matrix */}
          <Card className="p-5 border border-border shadow-xs">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-base text-foreground">
                    Branch Availability & Pricing
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Active at {availableBranchesCount} of {item.branchAvailability.length} branches.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Branch</TableHead>
                    <TableHead className="w-28">City</TableHead>
                    <TableHead className="w-32 text-center">Availability</TableHead>
                    <TableHead className="w-36 text-right">Selling Price</TableHead>
                    <TableHead className="w-24 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {item.branchAvailability.map((b) => (
                    <TableRow key={b.id} className="hover:bg-muted/20">
                      <TableCell>
                        <div className="font-medium text-foreground">{b.branch.name}</div>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {b.branch.code}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {b.branch.city}
                      </TableCell>
                      <TableCell className="text-center">
                        {b.isAvailable ? (
                          <Badge
                            variant="default"
                            className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-xs"
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Available
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            <XCircle className="mr-1 h-3 w-3" />
                            Disabled
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {b.price !== null ? (
                          <span className="text-emerald-600 font-bold" title="Branch override price">
                            ${b.price.toFixed(2)}{' '}
                            <span className="text-[10px] font-normal text-muted-foreground">(custom)</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground" title="Standard base price">
                            ${item.price.toFixed(2)}{' '}
                            <span className="text-[10px] font-normal">(base)</span>
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {canUpdateBranch && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenBranchDialog(b)}
                            className="h-7 px-2 text-xs"
                          >
                            Edit
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>

        {/* Right Column: Specifications & Meta Details */}
        <div className="space-y-6">
          <Card className="p-5 border border-border shadow-xs space-y-4">
            <h3 className="font-semibold text-sm text-foreground border-b border-border/60 pb-2">
              Item Details
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Category:</span>
                <span className="font-medium text-foreground">{item.category.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base Price:</span>
                <span className="font-mono font-medium text-foreground">
                  ${item.price.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Prep Time:</span>
                <span className="font-mono text-foreground">
                  {item.preparationTimeMinutes} minutes
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <Badge
                  variant={item.status === 'ACTIVE' ? 'default' : 'secondary'}
                  className="text-[10px]"
                >
                  {item.status}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">BOM Ingredients:</span>
                <span className="font-mono text-foreground font-semibold">
                  {item.recipeIngredients.length}
                </span>
              </div>
            </div>

            <div className="border-t border-border/60 pt-3 space-y-2 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                <span>Created: {new Date(item.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                <span>Updated: {new Date(item.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Edit Item Modal */}
      {canUpdateItem && (
        <MenuItemDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          item={item}
          categories={categories}
          onSuccess={handleRefresh}
        />
      )}

      {/* Recipe BOM Editor Modal */}
      {canUpdateRecipe && (
        <RecipeEditorDialog
          open={recipeDialogOpen}
          onOpenChange={setRecipeDialogOpen}
          menuItemId={item.id}
          menuItemName={item.name}
          currentRecipe={item.recipeIngredients}
          availableIngredients={availableIngredients}
          onSuccess={handleRefresh}
        />
      )}

      {/* Branch Pricing Modal */}
      {selectedBranchRecord && (
        <BranchAvailabilityDialog
          open={branchDialogOpen}
          onOpenChange={setBranchDialogOpen}
          menuItemId={item.id}
          menuItemName={item.name}
          basePrice={item.price}
          branchRecord={selectedBranchRecord}
          onSuccess={handleRefresh}
        />
      )}

      {/* Status Confirmation Modal */}
      {canDeactivateItem && (
        <MenuStatusDialog
          open={statusDialogOpen}
          onOpenChange={setStatusDialogOpen}
          title={item.status === 'ACTIVE' ? 'Deactivate Menu Item' : 'Activate Menu Item'}
          itemName={item.name}
          itemType="item"
          currentStatus={item.status}
          onConfirm={() => toggleMenuItemStatus(item.id)}
          onSuccess={handleRefresh}
        />
      )}
    </div>
  );
}
