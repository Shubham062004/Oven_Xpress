'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Search,
  ScrollText,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Clock,
} from 'lucide-react';

import type { MenuItemListItem, CategoryItem } from '@/lib/menu/types';

import { buttonVariants } from '@/components/ui/button';
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

interface RecipeListProps {
  items: MenuItemListItem[];
  categories: CategoryItem[];
}

export function RecipeList({ items, categories }: RecipeListProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [bomFilter, setBomFilter] = useState<'ALL' | 'CONFIGURED' | 'MISSING'>('ALL');

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        search.trim() === '' ||
        item.name.toLowerCase().includes(search.toLowerCase());

      const matchesCategory =
        categoryFilter === 'ALL' || item.categoryId === categoryFilter;

      const matchesBom =
        bomFilter === 'ALL' ||
        (bomFilter === 'CONFIGURED' && item.recipeConfigured) ||
        (bomFilter === 'MISSING' && !item.recipeConfigured);

      return matchesSearch && matchesCategory && matchesBom;
    });
  }, [items, search, categoryFilter, bomFilter]);

  const configuredCount = useMemo(
    () => items.filter((i) => i.recipeConfigured).length,
    [items]
  );

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search recipes by item name..."
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
            value={bomFilter}
            onValueChange={(val) => {
              if (val) setBomFilter(val as 'ALL' | 'CONFIGURED' | 'MISSING');
            }}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Recipe Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Recipe Status</SelectItem>
              <SelectItem value="CONFIGURED">BOM Configured</SelectItem>
              <SelectItem value="MISSING">Missing Recipe</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="text-xs text-muted-foreground flex items-center gap-1.5 self-end sm:self-auto">
          <ScrollText className="h-4 w-4 text-primary" />
          <span>
            <strong>{configuredCount}</strong> of <strong>{items.length}</strong> items have recipes
          </span>
        </div>
      </div>

      {/* Content */}
      {filteredItems.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No recipes found"
          description="No menu items matched your current filter criteria."
        />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden rounded-lg border border-border bg-card shadow-sm md:block overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Menu Item</TableHead>
                  <TableHead className="w-36">Category</TableHead>
                  <TableHead className="w-32 text-center">Prep Time</TableHead>
                  <TableHead className="w-44 text-center">BOM Status</TableHead>
                  <TableHead className="w-36 text-center">Raw Materials</TableHead>
                  <TableHead className="w-36 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell>
                      <Link
                        href={`/menu/items/${item.id}`}
                        className="font-semibold text-foreground hover:underline flex items-center gap-1.5 group"
                      >
                        {item.name}
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                      </Link>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {item.category.name}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-center text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {item.preparationTimeMinutes} min
                      </span>
                    </TableCell>

                    <TableCell className="text-center">
                      {item.recipeConfigured ? (
                        <Badge
                          variant="secondary"
                          className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-xs"
                        >
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                          Configured
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-xs"
                        >
                          <AlertCircle className="mr-1 h-3.5 w-3.5" />
                          Missing Recipe
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="text-center">
                      <span className="font-mono text-sm font-medium">
                        {item.ingredientCount} ingredient(s)
                      </span>
                    </TableCell>

                    <TableCell className="text-right">
                      <Link
                        href={`/menu/items/${item.id}`}
                        className={buttonVariants({
                          variant: 'outline',
                          size: 'sm',
                          className: 'h-8 px-2.5 text-xs gap-1',
                        })}
                      >
                        <ScrollText className="h-3.5 w-3.5" />
                        Manage BOM
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filteredItems.map((item) => (
              <Card key={item.id} className="p-4 border border-border shadow-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/menu/items/${item.id}`}
                      className="font-semibold text-foreground hover:underline"
                    >
                      {item.name}
                    </Link>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {item.category.name}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {item.preparationTimeMinutes}m prep
                      </span>
                    </div>
                  </div>

                  {item.recipeConfigured ? (
                    <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600">
                      {item.ingredientCount} ing.
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-amber-600">
                      Missing
                    </Badge>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5">
                  <span className="text-xs text-muted-foreground">
                    Base: ${item.price.toFixed(2)}
                  </span>
                  <Link
                    href={`/menu/items/${item.id}`}
                    className={buttonVariants({
                      variant: 'outline',
                      size: 'sm',
                      className: 'h-7 px-2.5 text-xs gap-1',
                    })}
                  >
                    <ScrollText className="h-3.5 w-3.5" />
                    Manage BOM
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
