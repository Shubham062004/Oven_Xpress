'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import {
  Utensils,
  Plus,
  Loader2,
  Users,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { TableStatus } from '@prisma/client';

import { getBranchTables, createTable, updateTableStatus } from '@/lib/tables/actions';
import type { TableItem } from '@/lib/tables/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface TableManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  branchName: string;
  canManage: boolean;
}

export function TableManagementDialog({
  open,
  onOpenChange,
  branchId,
  branchName,
  canManage,
}: TableManagementDialogProps) {
  const [tables, setTables] = useState<TableItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Create form state
  const [isAdding, setIsAdding] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [newCapacity, setNewCapacity] = useState('4');

  const loadTables = useCallback(async () => {
    if (!branchId) return;
    setIsLoading(true);
    const res = await getBranchTables(branchId);
    if (res.success && res.data) {
      setTables(res.data);
    } else {
      toast.error(res.error || 'Failed to load tables');
    }
    setIsLoading(false);
  }, [branchId]);

  useEffect(() => {
    let active = true;
    if (open && branchId) {
      void getBranchTables(branchId).then((res) => {
        if (active && res.success && res.data) {
          setTables(res.data);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [open, branchId]);

  const handleCreateTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableNumber.trim()) return;

    startTransition(async () => {
      const res = await createTable({
        branchId,
        tableNumber: newTableNumber.trim().toUpperCase(),
        capacity: parseInt(newCapacity, 10) || 4,
        status: TableStatus.AVAILABLE,
      });

      if (res.success) {
        toast.success(`Table ${newTableNumber.trim().toUpperCase()} added.`);
        setNewTableNumber('');
        setNewCapacity('4');
        setIsAdding(false);
        loadTables();
      } else {
        toast.error(res.error || 'Failed to add table');
      }
    });
  };

  const handleStatusChange = (tableId: string, status: TableStatus) => {
    startTransition(async () => {
      const res = await updateTableStatus({ tableId, status });
      if (res.success) {
        toast.success(`Table status updated to ${status}`);
        loadTables();
      } else {
        toast.error(res.error || 'Failed to update table status');
      }
    });
  };

  const getStatusBadge = (status: TableStatus) => {
    switch (status) {
      case TableStatus.AVAILABLE:
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
            Available
          </Badge>
        );
      case TableStatus.OCCUPIED:
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30">
            Occupied
          </Badge>
        );
      case TableStatus.CLEANING:
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
            Cleaning
          </Badge>
        );
      case TableStatus.RESERVED:
        return (
          <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30">
            Reserved
          </Badge>
        );
      case TableStatus.MAINTENANCE:
        return (
          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30">
            Maintenance
          </Badge>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Utensils className="size-5 text-primary" />
              <DialogTitle>Dining Tables — {branchName}</DialogTitle>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={loadTables}
              disabled={isLoading || isPending}
              aria-label="Refresh tables"
            >
              <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <DialogDescription>
            Manage restaurant dining tables, review real-time seating availability, and update table cleaning states.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2 space-y-4">
          {canManage && (
            <div className="border border-border/60 rounded-lg p-3 bg-muted/20">
              {!isAdding ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAdding(true)}
                  className="gap-1.5 text-xs font-medium"
                >
                  <Plus className="size-3.5" />
                  Add New Table
                </Button>
              ) : (
                <form onSubmit={handleCreateTable} className="space-y-3">
                  <div className="text-xs font-semibold text-foreground">Add New Dining Table</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="tableNumber" className="text-xs">
                        Table Number / Label
                      </Label>
                      <Input
                        id="tableNumber"
                        placeholder="e.g. T-07"
                        value={newTableNumber}
                        onChange={(e) => setNewTableNumber(e.target.value)}
                        disabled={isPending}
                        required
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="capacity" className="text-xs">
                        Seating Capacity
                      </Label>
                      <Input
                        id="capacity"
                        type="number"
                        min="1"
                        max="50"
                        value={newCapacity}
                        onChange={(e) => setNewCapacity(e.target.value)}
                        disabled={isPending}
                        required
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 justify-end pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsAdding(false)}
                      disabled={isPending}
                      className="h-7 text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isPending || !newTableNumber.trim()}
                      className="h-7 text-xs gap-1"
                    >
                      {isPending ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-3" />
                      )}
                      Save Table
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="size-6 animate-spin" />
              <span className="text-xs">Loading tables...</span>
            </div>
          ) : tables.length === 0 ? (
            <div className="text-center py-10 border border-dashed rounded-lg text-muted-foreground">
              <AlertCircle className="size-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">No dining tables configured for this branch.</p>
              {canManage && (
                <p className="text-xs text-muted-foreground mt-1">
                  Click &ldquo;Add New Table&rdquo; above to set up dining spaces.
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {tables.map((tbl) => (
                <div
                  key={tbl.id}
                  className="border border-border/70 rounded-lg p-3 bg-card shadow-xs flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-base text-foreground flex items-center gap-1.5">
                        {tbl.tableNumber}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Users className="size-3.5" />
                        {tbl.capacity} Seats
                      </div>
                    </div>
                    {getStatusBadge(tbl.status)}
                  </div>

                  {tbl.activeOrderNumber && (
                    <div className="text-xs bg-blue-500/10 text-blue-800 dark:text-blue-300 p-1.5 rounded text-center font-medium">
                      Active: {tbl.activeOrderNumber}
                    </div>
                  )}

                  {canManage && (
                    <div className="flex items-center gap-1.5 pt-2 border-t border-border/40 text-xs">
                      {tbl.status === TableStatus.CLEANING && (
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => handleStatusChange(tbl.id, TableStatus.AVAILABLE)}
                          disabled={isPending}
                          className="w-full gap-1 text-emerald-600 dark:text-emerald-400"
                        >
                          <Sparkles className="size-3" />
                          Mark Cleaned
                        </Button>
                      )}
                      {tbl.status === TableStatus.AVAILABLE && (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => handleStatusChange(tbl.id, TableStatus.RESERVED)}
                          disabled={isPending}
                          className="w-full text-purple-600 dark:text-purple-400"
                        >
                          Reserve
                        </Button>
                      )}
                      {tbl.status === TableStatus.RESERVED && (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => handleStatusChange(tbl.id, TableStatus.AVAILABLE)}
                          disabled={isPending}
                          className="w-full text-muted-foreground"
                        >
                          Cancel Reserve
                        </Button>
                      )}
                      {tbl.status === TableStatus.OCCUPIED && (
                        <span className="text-[11px] text-muted-foreground italic w-full text-center">
                          Freed on order completion
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
