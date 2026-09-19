'use client';

import Link from 'next/link';
import {
  UtensilsCrossed,
  Layers,
  Wheat,
  ScrollText,
  Plus,
  ArrowRight,
} from 'lucide-react';

import type { MenuSummaryStats, CategoryItem, MenuItemListItem } from '@/lib/menu/types';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface MenuOverviewProps {
  stats: MenuSummaryStats;
  categories: CategoryItem[];
  items: MenuItemListItem[];
  onSelectTab: (tab: string) => void;
  onOpenCreateItem?: () => void;
  onOpenCreateCategory?: () => void;
  onOpenCreateIngredient?: () => void;
  canCreate: boolean;
}

export function MenuOverview({
  stats,
  categories,
  items,
  onSelectTab,
  onOpenCreateItem,
  onOpenCreateCategory,
  onOpenCreateIngredient,
  canCreate,
}: MenuOverviewProps) {
  const recentItems = items.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Items */}
        <Card className="p-4 border border-border shadow-xs hover:border-primary/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Menu Items
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <UtensilsCrossed className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-foreground">
              {stats.totalItems}
            </span>
            <span className="text-xs text-muted-foreground">
              ({stats.activeItems} active)
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-xs">
            <span className="text-muted-foreground">Catalog items</span>
            <button
              onClick={() => onSelectTab('items')}
              className="text-primary hover:underline flex items-center gap-0.5 text-xs font-medium cursor-pointer"
            >
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </Card>

        {/* Categories */}
        <Card className="p-4 border border-border shadow-xs hover:border-primary/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Categories
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-foreground">
              {stats.totalCategories}
            </span>
            <span className="text-xs text-muted-foreground">classifications</span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-xs">
            <span className="text-muted-foreground">Active categories</span>
            <button
              onClick={() => onSelectTab('categories')}
              className="text-primary hover:underline flex items-center gap-0.5 text-xs font-medium cursor-pointer"
            >
              Manage <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </Card>

        {/* Raw Ingredients */}
        <Card className="p-4 border border-border shadow-xs hover:border-primary/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Raw Ingredients
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Wheat className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-foreground">
              {stats.totalIngredients}
            </span>
            <span className="text-xs text-muted-foreground">centralized units</span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-xs">
            <span className="text-muted-foreground">BOM materials</span>
            <button
              onClick={() => onSelectTab('ingredients')}
              className="text-primary hover:underline flex items-center gap-0.5 text-xs font-medium cursor-pointer"
            >
              Manage <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </Card>

        {/* Recipe BOM Coverage */}
        <Card className="p-4 border border-border shadow-xs hover:border-primary/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Recipe BOM Coverage
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ScrollText className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-foreground">
              {stats.recipePercentage}%
            </span>
            <span className="text-xs text-muted-foreground">
              ({stats.itemsWithRecipe} of {stats.totalItems})
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-xs">
            <span className="text-muted-foreground">Ready for inventory</span>
            <button
              onClick={() => onSelectTab('recipes')}
              className="text-primary hover:underline flex items-center gap-0.5 text-xs font-medium cursor-pointer"
            >
              Review <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </Card>
      </div>

      {/* Quick Action Shortcuts Banner */}
      {canCreate && (
        <Card className="p-4 border border-border bg-muted/20 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h4 className="font-semibold text-sm text-foreground">
              Quick Menu Catalog Actions
            </h4>
            <p className="text-xs text-muted-foreground">
              Quickly create dishes, organize menu groups, or register raw materials for recipes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onOpenCreateItem && (
              <Button size="sm" onClick={onOpenCreateItem} className="h-8 gap-1 text-xs">
                <Plus className="h-3.5 w-3.5" />
                New Item
              </Button>
            )}
            {onOpenCreateCategory && (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenCreateCategory}
                className="h-8 gap-1 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                New Category
              </Button>
            )}
            {onOpenCreateIngredient && (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenCreateIngredient}
                className="h-8 gap-1 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                New Ingredient
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Grid: Category Breakdown & Recent Menu Items */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Categories Breakdown */}
        <Card className="p-5 border border-border shadow-xs">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Category Breakdown
            </h3>
            <button
              onClick={() => onSelectTab('categories')}
              className="text-xs text-primary hover:underline font-medium cursor-pointer"
            >
              View all
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {categories.map((cat) => {
              const count = cat._count?.items ?? 0;
              const percent =
                stats.totalItems > 0 ? Math.round((count / stats.totalItems) * 100) : 0;

              return (
                <div key={cat.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{cat.name}</span>
                    <span className="text-muted-foreground font-mono">
                      {count} items ({percent}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Recently Configured Items */}
        <Card className="p-5 border border-border shadow-xs">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4 text-primary" />
              Menu Highlights
            </h3>
            <button
              onClick={() => onSelectTab('items')}
              className="text-xs text-primary hover:underline font-medium cursor-pointer"
            >
              View all
            </button>
          </div>

          <div className="mt-4 divide-y divide-border/40">
            {recentItems.map((item) => (
              <div
                key={item.id}
                className="py-2.5 flex items-center justify-between hover:bg-muted/30 px-2 rounded-md transition-colors"
              >
                <div>
                  <Link
                    href={`/menu/items/${item.id}`}
                    className="font-medium text-sm text-foreground hover:underline"
                  >
                    {item.name}
                  </Link>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    <span>{item.category.name}</span>
                    <span>•</span>
                    <span>{item.preparationTimeMinutes}m prep</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-semibold text-foreground">
                    ${item.price.toFixed(2)}
                  </span>
                  {item.recipeConfigured ? (
                    <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600">
                      BOM ✓
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-amber-600">
                      No BOM
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
