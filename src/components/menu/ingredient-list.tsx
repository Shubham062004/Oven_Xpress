'use client';

import { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Pencil,
  Power,
  Wheat,
  ScrollText,
} from 'lucide-react';

import type { IngredientItem } from '@/lib/menu/types';
import { toggleIngredientStatus } from '@/lib/menu/ingredient-actions';
import { ALL_UNITS, UNIT_LABELS } from '@/lib/validations/menu';
import type { IngredientUnit } from '@prisma/client';

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

import { IngredientDialog } from '@/components/menu/ingredient-dialog';
import { MenuStatusDialog } from '@/components/menu/menu-status-dialog';

interface IngredientListProps {
  ingredients: IngredientItem[];
  canCreate: boolean;
  canUpdate: boolean;
  canDeactivate: boolean;
  onRefresh: () => void;
}

export function IngredientList({
  ingredients,
  canCreate,
  canUpdate,
  canDeactivate,
  onRefresh,
}: IngredientListProps) {
  const [search, setSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState<IngredientUnit | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<IngredientItem | null>(null);

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [targetIngredient, setTargetIngredient] = useState<IngredientItem | null>(null);

  const filteredIngredients = useMemo(() => {
    return ingredients.filter((ing) => {
      const matchesSearch =
        search.trim() === '' ||
        ing.name.toLowerCase().includes(search.toLowerCase()) ||
        (ing.description && ing.description.toLowerCase().includes(search.toLowerCase()));

      const matchesUnit = unitFilter === 'ALL' || ing.unit === unitFilter;
      const matchesStatus = statusFilter === 'ALL' || ing.status === statusFilter;

      return matchesSearch && matchesUnit && matchesStatus;
    });
  }, [ingredients, search, unitFilter, statusFilter]);

  const handleOpenCreate = () => {
    setEditingIngredient(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (ing: IngredientItem) => {
    setEditingIngredient(ing);
    setDialogOpen(true);
  };

  const handleOpenStatusDialog = (ing: IngredientItem) => {
    setTargetIngredient(ing);
    setStatusDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center flex-wrap">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search ingredients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-sm"
            />
          </div>

          <Select
            value={unitFilter}
            onValueChange={(val) => {
              if (val) setUnitFilter(val as IngredientUnit | 'ALL');
            }}
          >
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue placeholder="Unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Units</SelectItem>
              {ALL_UNITS.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
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
            Add Ingredient
          </Button>
        )}
      </div>

      {/* Table/Cards */}
      {filteredIngredients.length === 0 ? (
        <EmptyState
          icon={Wheat}
          title="No ingredients found"
          description={
            search || unitFilter !== 'ALL' || statusFilter !== 'ALL'
              ? 'Try adjusting your search query or filters.'
              : 'Add your raw materials and ingredients to build recipe Bills of Materials (BOM).'
          }
          action={
            canCreate && !search && unitFilter === 'ALL' && statusFilter === 'ALL'
              ? {
                  label: 'Add Ingredient',
                  onClick: handleOpenCreate,
                }
              : undefined
          }
        />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden rounded-lg border border-border bg-card shadow-sm md:block overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Ingredient Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-32 text-center">Base Unit</TableHead>
                  <TableHead className="w-32 text-center">Recipe Usage</TableHead>
                  <TableHead className="w-28 text-center">Status</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIngredients.map((ing) => (
                  <TableRow key={ing.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-semibold text-foreground">
                      {ing.name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {ing.description || '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="font-mono text-xs">
                        {UNIT_LABELS[ing.unit] || ing.unit}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="font-mono text-xs">
                        <ScrollText className="mr-1 h-3 w-3" />
                        {ing._count?.recipes ?? 0} recipes
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={ing.status === 'ACTIVE' ? 'default' : 'secondary'}
                        className={
                          ing.status === 'ACTIVE'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                            : 'bg-muted text-muted-foreground'
                        }
                      >
                        {ing.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canUpdate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(ing)}
                            className="h-8 px-2 text-xs"
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            Edit
                          </Button>
                        )}
                        {canDeactivate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenStatusDialog(ing)}
                            className={`h-8 px-2 text-xs ${
                              ing.status === 'ACTIVE'
                                ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400'
                                : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400'
                            }`}
                            title={ing.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
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

          {/* Mobile Cards */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filteredIngredients.map((ing) => (
              <Card key={ing.id} className="p-4 border border-border shadow-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{ing.name}</span>
                      <Badge
                        variant={ing.status === 'ACTIVE' ? 'default' : 'secondary'}
                        className="text-[10px] py-0 px-1.5"
                      >
                        {ing.status}
                      </Badge>
                    </div>
                    {ing.description && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {ing.description}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">
                    {ing.unit}
                  </Badge>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <ScrollText className="h-3.5 w-3.5" />
                    <span>{ing._count?.recipes ?? 0} recipe(s)</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {canUpdate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEdit(ing)}
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
                        onClick={() => handleOpenStatusDialog(ing)}
                        className="h-7 px-2 text-xs"
                      >
                        <Power className="h-3.5 w-3.5 mr-1" />
                        {ing.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
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
      <IngredientDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        ingredient={editingIngredient}
        onSuccess={onRefresh}
      />

      {/* Status Confirmation Dialog */}
      {targetIngredient && (
        <MenuStatusDialog
          open={statusDialogOpen}
          onOpenChange={setStatusDialogOpen}
          title={targetIngredient.status === 'ACTIVE' ? 'Deactivate Ingredient' : 'Activate Ingredient'}
          itemName={targetIngredient.name}
          itemType="ingredient"
          currentStatus={targetIngredient.status}
          onConfirm={() => toggleIngredientStatus(targetIngredient.id)}
          onSuccess={onRefresh}
        />
      )}
    </div>
  );
}
