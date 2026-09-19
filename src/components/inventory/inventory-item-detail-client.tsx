'use client';

import { useState, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Building2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowDownToLine,
  Trash2,
  SlidersHorizontal,
  ArrowRightLeft,
  Scale,
  Settings2,
  TrendingUp,
  Clock,
} from 'lucide-react';
import type { IngredientUnit } from '@prisma/client';

import type { InventoryItemDetail } from '@/lib/inventory/types';
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
import { EmptyState } from '@/components/ui/empty-state';

import { StockReceiptDialog } from '@/components/inventory/stock-receipt-dialog';
import { WastageDialog } from '@/components/inventory/wastage-dialog';
import { StockAdjustmentDialog } from '@/components/inventory/stock-adjustment-dialog';
import { StockTransferDialog } from '@/components/inventory/stock-transfer-dialog';
import { StockReconciliationDialog } from '@/components/inventory/stock-reconciliation-dialog';
import { InventoryItemDialog } from '@/components/inventory/inventory-item-dialog';

interface InventoryItemDetailClientProps {
  item: InventoryItemDetail;
  branches: { id: string; name: string; code: string }[];
  ingredients: { id: string; name: string; unit: IngredientUnit }[];
}

export function InventoryItemDetailClient({
  item,
  branches,
  ingredients,
}: InventoryItemDetailClientProps) {
  const router = useRouter();
  const user = useAuth();
  const [, startTransition] = useTransition();

  // Dialog states
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [wastageOpen, setWastageOpen] = useState(false);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  // Permissions
  const canCreate = hasPermission(user, PERMISSIONS.INVENTORY_CREATE);
  const canUpdate = hasPermission(user, PERMISSIONS.INVENTORY_UPDATE);
  const canAdjust = hasPermission(user, PERMISSIONS.INVENTORY_ADJUST);
  const canTransfer = hasPermission(user, PERMISSIONS.INVENTORY_TRANSFER);
  const canWastage = hasPermission(user, PERMISSIONS.INVENTORY_WASTAGE);
  const canReconcile = hasPermission(user, PERMISSIONS.INVENTORY_RECONCILE);

  const handleRefresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  return (
    <div className="space-y-6">
      {/* Top Header / Breadcrumbs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Link
            href="/inventory"
            className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'h-8 px-2' })}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to Inventory
          </Link>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {canCreate && (
            <Button
              size="sm"
              onClick={() => setReceiptOpen(true)}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            >
              <ArrowDownToLine className="h-4 w-4" />
              Receive Stock
            </Button>
          )}

          {canWastage && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWastageOpen(true)}
              className="gap-1.5 text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
              Record Wastage
            </Button>
          )}

          {canAdjust && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAdjustmentOpen(true)}
              className="gap-1.5"
            >
              <SlidersHorizontal className="h-4 w-4 text-blue-500" />
              Adjust
            </Button>
          )}

          {canTransfer && branches.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTransferOpen(true)}
              className="gap-1.5"
            >
              <ArrowRightLeft className="h-4 w-4 text-indigo-500" />
              Transfer
            </Button>
          )}

          {canReconcile && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReconcileOpen(true)}
              className="gap-1.5"
            >
              <Scale className="h-4 w-4 text-purple-500" />
              Reconcile
            </Button>
          )}

          {canUpdate && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfigOpen(true)}
              className="gap-1.5"
            >
              <Settings2 className="h-4 w-4" />
              Thresholds
            </Button>
          )}
        </div>
      </div>

      {/* Main Spec Card */}
      <Card className="p-6 border border-border shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {item.ingredientName}
              </h1>
              {item.healthStatus === 'HEALTHY' && (
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                  Healthy Stock
                </Badge>
              )}
              {item.healthStatus === 'LOW_STOCK' && (
                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20">
                  <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                  Low Stock
                </Badge>
              )}
              {item.healthStatus === 'OUT_OF_STOCK' && (
                <Badge variant="destructive">
                  <XCircle className="mr-1 h-3.5 w-3.5" />
                  Out of Stock
                </Badge>
              )}
              <Badge variant={item.status === 'ACTIVE' ? 'secondary' : 'outline'}>
                {item.status}
              </Badge>
            </div>

            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1 font-medium text-foreground">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                {item.branchName} ({item.branchCode})
              </span>
              <span>•</span>
              <span>Canonical Unit: <strong className="text-foreground">{item.unit}</strong></span>
              {item.ingredientDescription && (
                <>
                  <span>•</span>
                  <span>{item.ingredientDescription}</span>
                </>
              )}
            </div>
          </div>

          <div className="text-left sm:text-right p-3 rounded-lg bg-muted/40 border border-border/60">
            <span className="text-xs text-muted-foreground uppercase font-semibold block">
              Current Available Stock
            </span>
            <span
              className={`font-mono text-3xl font-extrabold ${
                item.currentStock <= 0
                  ? 'text-destructive'
                  : item.healthStatus === 'LOW_STOCK'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-foreground'
              }`}
            >
              {item.currentStock} {item.unit}
            </span>
            <div className="mt-1 flex items-center justify-end gap-2 text-xs text-muted-foreground font-mono">
              <span>Min: {item.minimumStock} {item.unit}</span>
              <span>•</span>
              <span>Reorder: {item.reorderLevel} {item.unit}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Historical Summary Breakdown Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4 border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Inflows</span>
            <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
            {item.summary.totalReceipts + item.summary.totalTransfersIn + item.summary.totalAdjustmentsIn} {item.unit}
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            {item.summary.totalReceipts} rec. + {item.summary.totalTransfersIn} trf. in
          </span>
        </Card>

        <Card className="p-4 border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Losses</span>
            <Trash2 className="h-4 w-4 text-destructive" />
          </div>
          <div className="mt-2 text-xl font-bold text-destructive font-mono">
            {item.summary.totalDamage + item.summary.totalWastage} {item.unit}
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            {item.summary.totalWastage} waste + {item.summary.totalDamage} damage
          </span>
        </Card>

        <Card className="p-4 border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Net Transfers</span>
            <ArrowRightLeft className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-foreground">
            {item.summary.totalTransfersIn - item.summary.totalTransfersOut > 0 ? '+' : ''}
            {item.summary.totalTransfersIn - item.summary.totalTransfersOut} {item.unit}
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            +{item.summary.totalTransfersIn} in / -{item.summary.totalTransfersOut} out
          </span>
        </Card>

        <Card className="p-4 border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Net Adjustments</span>
            <SlidersHorizontal className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-foreground">
            {item.summary.totalAdjustmentsIn - item.summary.totalAdjustmentsOut > 0 ? '+' : ''}
            {item.summary.totalAdjustmentsIn - item.summary.totalAdjustmentsOut} {item.unit}
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Reconciliation & counts
          </span>
        </Card>
      </div>

      {/* Item Ledger Timeline Table */}
      <Card className="p-5 border border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Stock Movement History</h2>
            <p className="text-xs text-muted-foreground">
              Complete chronological audit trail for this ingredient at {item.branchName}.
            </p>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {item.transactions.length} transactions
          </Badge>
        </div>

        {item.transactions.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No transactions yet"
            description="Incoming receipts, kitchen wastage, and adjustments will be logged here."
          />
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Time</TableHead>
                  <TableHead>Transaction Type</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Operator</TableHead>
                  <TableHead>Reference / Reason / Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {item.transactions.map((tx) => (
                  <TableRow key={tx.id} className="hover:bg-muted/30">
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap font-mono">
                      {new Date(tx.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[11px] font-medium ${
                          tx.direction === 'IN'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                            : 'bg-destructive/10 text-destructive border-destructive/20'
                        }`}
                      >
                        {tx.direction === 'IN' ? '+' : '-'} {tx.typeLabel}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      <span
                        className={`font-mono text-xs font-bold ${
                          tx.direction === 'IN'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-destructive'
                        }`}
                      >
                        {tx.direction === 'IN' ? '+' : '-'}
                        {tx.quantity} {tx.unit}
                      </span>
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground">
                      {tx.performedBy}
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground">
                      {tx.reasonLabel ? (
                        <span className="font-semibold text-foreground mr-1.5">
                          [{tx.reasonLabel}]
                        </span>
                      ) : null}
                      {tx.note || (tx.referenceId ? `Ref: ${tx.referenceId}` : '—')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Modals */}
      <StockReceiptDialog
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        branches={branches}
        ingredients={ingredients}
        defaultBranchId={item.branchId}
        defaultIngredientId={item.ingredientId}
        onSuccess={handleRefresh}
      />

      <WastageDialog
        open={wastageOpen}
        onOpenChange={setWastageOpen}
        branches={branches}
        ingredients={ingredients}
        defaultBranchId={item.branchId}
        defaultIngredientId={item.ingredientId}
        currentStockHint={item.currentStock}
        onSuccess={handleRefresh}
      />

      <StockAdjustmentDialog
        open={adjustmentOpen}
        onOpenChange={setAdjustmentOpen}
        branches={branches}
        ingredients={ingredients}
        defaultBranchId={item.branchId}
        defaultIngredientId={item.ingredientId}
        currentStockHint={item.currentStock}
        onSuccess={handleRefresh}
      />

      <StockTransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        branches={branches}
        ingredients={ingredients}
        defaultSourceBranchId={item.branchId}
        defaultIngredientId={item.ingredientId}
        currentStockHint={item.currentStock}
        onSuccess={handleRefresh}
      />

      <StockReconciliationDialog
        open={reconcileOpen}
        onOpenChange={setReconcileOpen}
        branches={branches}
        ingredients={ingredients}
        defaultBranchId={item.branchId}
        defaultIngredientId={item.ingredientId}
        currentStockHint={item.currentStock}
        onSuccess={handleRefresh}
      />

      <InventoryItemDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        item={item}
        onSuccess={handleRefresh}
      />
    </div>
  );
}
