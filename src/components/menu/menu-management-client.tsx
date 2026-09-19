'use client';

import { useState, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  UtensilsCrossed,
  Layers,
  Wheat,
  ScrollText,
  BarChart3,
  Plus,
} from 'lucide-react';

import type {
  CategoryItem,
  IngredientItem,
  MenuItemListItem,
  MenuSummaryStats,
} from '@/lib/menu/types';
import { useAuth } from '@/providers/auth-provider';
import { hasPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';

import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { MenuOverview } from '@/components/menu/menu-overview';
import { MenuItemList } from '@/components/menu/menu-item-list';
import { CategoryList } from '@/components/menu/category-list';
import { IngredientList } from '@/components/menu/ingredient-list';
import { RecipeList } from '@/components/menu/recipe-list';
import { MenuItemDialog } from '@/components/menu/menu-item-dialog';
import { CategoryDialog } from '@/components/menu/category-dialog';
import { IngredientDialog } from '@/components/menu/ingredient-dialog';

interface BranchOption {
  id: string;
  name: string;
  code: string;
}

interface MenuManagementClientProps {
  initialCategories: CategoryItem[];
  initialIngredients: IngredientItem[];
  initialItems: MenuItemListItem[];
  initialStats: MenuSummaryStats;
  branches: BranchOption[];
}

export function MenuManagementClient({
  initialCategories,
  initialIngredients,
  initialItems,
  initialStats,
  branches,
}: MenuManagementClientProps) {
  const router = useRouter();
  const user = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [, startTransition] = useTransition();

  // Dialog states for global actions
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [ingredientDialogOpen, setIngredientDialogOpen] = useState(false);

  // Permission flags
  const canReadCategory = hasPermission(user, PERMISSIONS.MENU_CATEGORY_READ);
  const canCreateCategory = hasPermission(user, PERMISSIONS.MENU_CATEGORY_CREATE);
  const canUpdateCategory = hasPermission(user, PERMISSIONS.MENU_CATEGORY_UPDATE);
  const canDeactivateCategory = hasPermission(user, PERMISSIONS.MENU_CATEGORY_DEACTIVATE);

  const canReadIngredient = hasPermission(user, PERMISSIONS.MENU_INGREDIENT_READ);
  const canCreateIngredient = hasPermission(user, PERMISSIONS.MENU_INGREDIENT_CREATE);
  const canUpdateIngredient = hasPermission(user, PERMISSIONS.MENU_INGREDIENT_UPDATE);
  const canDeactivateIngredient = hasPermission(user, PERMISSIONS.MENU_INGREDIENT_DEACTIVATE);

  const canReadItem = hasPermission(user, PERMISSIONS.MENU_ITEM_READ);
  const canCreateItem = hasPermission(user, PERMISSIONS.MENU_ITEM_CREATE);
  const canUpdateItem = hasPermission(user, PERMISSIONS.MENU_ITEM_UPDATE);
  const canDeactivateItem = hasPermission(user, PERMISSIONS.MENU_ITEM_DEACTIVATE);

  const handleRefresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title="Menu & Recipe Management"
        description="Centralized menu catalog, raw ingredient Bill of Materials (BOM), and branch-specific pricing."
      >
        <div className="flex items-center gap-2">
          {canCreateItem && (
            <Button
              onClick={() => setItemDialogOpen(true)}
              className="gap-1.5 text-xs sm:text-sm"
            >
              <Plus className="h-4 w-4" />
              New Menu Item
            </Button>
          )}
        </div>
      </PageHeader>

      {/* Tabs Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/60 p-1 flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="gap-1.5 text-xs sm:text-sm">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          {canReadItem && (
            <TabsTrigger value="items" className="gap-1.5 text-xs sm:text-sm">
              <UtensilsCrossed className="h-4 w-4" />
              Menu Items ({initialItems.length})
            </TabsTrigger>
          )}
          {canReadCategory && (
            <TabsTrigger value="categories" className="gap-1.5 text-xs sm:text-sm">
              <Layers className="h-4 w-4" />
              Categories ({initialCategories.length})
            </TabsTrigger>
          )}
          {canReadIngredient && (
            <TabsTrigger value="ingredients" className="gap-1.5 text-xs sm:text-sm">
              <Wheat className="h-4 w-4" />
              Ingredients ({initialIngredients.length})
            </TabsTrigger>
          )}
          {canReadItem && (
            <TabsTrigger value="recipes" className="gap-1.5 text-xs sm:text-sm">
              <ScrollText className="h-4 w-4" />
              Recipes / BOM
            </TabsTrigger>
          )}
        </TabsList>

        {/* Tab 1: Overview */}
        <TabsContent value="overview" className="outline-hidden focus:outline-hidden">
          <MenuOverview
            stats={initialStats}
            categories={initialCategories}
            items={initialItems}
            onSelectTab={setActiveTab}
            onOpenCreateItem={canCreateItem ? () => setItemDialogOpen(true) : undefined}
            onOpenCreateCategory={canCreateCategory ? () => setCategoryDialogOpen(true) : undefined}
            onOpenCreateIngredient={canCreateIngredient ? () => setIngredientDialogOpen(true) : undefined}
            canCreate={canCreateItem || canCreateCategory || canCreateIngredient}
          />
        </TabsContent>

        {/* Tab 2: Menu Items */}
        {canReadItem && (
          <TabsContent value="items" className="outline-hidden focus:outline-hidden">
            <MenuItemList
              items={initialItems}
              categories={initialCategories}
              branches={branches}
              canCreate={canCreateItem}
              canUpdate={canUpdateItem}
              canDeactivate={canDeactivateItem}
              onRefresh={handleRefresh}
            />
          </TabsContent>
        )}

        {/* Tab 3: Categories */}
        {canReadCategory && (
          <TabsContent value="categories" className="outline-hidden focus:outline-hidden">
            <CategoryList
              categories={initialCategories}
              canCreate={canCreateCategory}
              canUpdate={canUpdateCategory}
              canDeactivate={canDeactivateCategory}
              onRefresh={handleRefresh}
            />
          </TabsContent>
        )}

        {/* Tab 4: Ingredients */}
        {canReadIngredient && (
          <TabsContent value="ingredients" className="outline-hidden focus:outline-hidden">
            <IngredientList
              ingredients={initialIngredients}
              canCreate={canCreateIngredient}
              canUpdate={canUpdateIngredient}
              canDeactivate={canDeactivateIngredient}
              onRefresh={handleRefresh}
            />
          </TabsContent>
        )}

        {/* Tab 5: Recipes */}
        {canReadItem && (
          <TabsContent value="recipes" className="outline-hidden focus:outline-hidden">
            <RecipeList items={initialItems} categories={initialCategories} />
          </TabsContent>
        )}
      </Tabs>

      {/* Global Quick Action Dialogs */}
      {canCreateItem && (
        <MenuItemDialog
          open={itemDialogOpen}
          onOpenChange={setItemDialogOpen}
          categories={initialCategories}
          onSuccess={handleRefresh}
        />
      )}

      {canCreateCategory && (
        <CategoryDialog
          open={categoryDialogOpen}
          onOpenChange={setCategoryDialogOpen}
          onSuccess={handleRefresh}
        />
      )}

      {canCreateIngredient && (
        <IngredientDialog
          open={ingredientDialogOpen}
          onOpenChange={setIngredientDialogOpen}
          onSuccess={handleRefresh}
        />
      )}
    </div>
  );
}
