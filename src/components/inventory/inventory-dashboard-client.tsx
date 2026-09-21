'use client';

import { useState, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Package,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  ArrowDownToLine,
  ArrowRightLeft,
  Trash2,
  SlidersHorizontal,
  Scale,
  PackagePlus,
  Search,
  Settings2,
  Building2,
  Clock,
  ChevronRight,
} from 'lucide-react';

import type {
  InventoryDashboardData,
  InventoryItemListItem,
  StockHealthStatus,
} from '@/lib/inventory/types';
import { StockTransactionType } from '@prisma/client';
import { useAuth } from '@/providers/auth-provider';
import { hasPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { StockReceiptDialog } from '@/components/inventory/stock-receipt-dialog';
import { WastageDialog } from '@/components/inventory/wastage-dialog';
import { StockAdjustmentDialog } from '@/components/inventory/stock-adjustment-dialog';
import { StockTransferDialog } from '@/components/inventory/stock-transfer-dialog';
import { StockReconciliationDialog } from '@/components/inventory/stock-reconciliation-dialog';
import { OpeningStockDialog } from '@/components/inventory/opening-stock-dialog';
import { InventoryItemDialog } from '@/components/inventory/inventory-item-dialog';

interface InventoryDashboardClientProps {
  initialData: InventoryDashboardData;
}

export function InventoryDashboardClient({ initialData }: InventoryDashboardClientProps) {
  const router = useRouter();
  const user = useAuth();
  const [, startTransition] = useTransition();

  const { stats, items, recentTransactions, branches, ingredients } = initialData;

  // Tabs: 'stock' | 'ledger'
  const [activeTab, setActiveTab] = useState<'stock' | 'ledger'>('stock');

  // Filters
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [healthFilter, setHealthFilter] = useState<'ALL' | StockHealthStatus>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<string>('ALL');

  // Modal States
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [wastageOpen, setWastageOpen] = useState(false);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [openingOpen, setOpeningOpen] = useState(false);
  const [itemConfigOpen, setItemConfigOpen] = useState(false);

  // Target item for contextual actions
  const [selectedItem, setSelectedItem] = useState<InventoryItemListItem | null>(null);

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

  // Contextual modal openers
  const openWastageForItem = (item: InventoryItemListItem) => {
    setSelectedItem(item);
    setWastageOpen(true);
  };

  const openAdjustForItem = (item: InventoryItemListItem) => {
    setSelectedItem(item);
    setAdjustmentOpen(true);
  };

  const openTransferForItem = (item: InventoryItemListItem) => {
    setSelectedItem(item);
    setTransferOpen(true);
  };

  const openReconcileForItem = (item: InventoryItemListItem) => {
    setSelectedItem(item);
    setReconcileOpen(true);
  };

  const openConfigForItem = (item: InventoryItemListItem) => {
    setSelectedItem(item);
    setItemConfigOpen(true);
  };

  // Filter items
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      search.trim() === '' ||
      item.ingredientName.toLowerCase().includes(search.toLowerCase()) ||
      item.branchName.toLowerCase().includes(search.toLowerCase()) ||
      item.branchCode.toLowerCase().includes(search.toLowerCase());

    const matchesBranch = branchFilter === 'ALL' || item.branchId === branchFilter;
    const matchesHealth = healthFilter === 'ALL' || item.healthStatus === healthFilter;
    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;

    return matchesSearch && matchesBranch && matchesHealth && matchesStatus;
  });

  // Filter transactions
  const filteredTransactions = recentTransactions.filter((tx) => {
    const matchesBranch = branchFilter === 'ALL' || tx.branchId === branchFilter;
    const matchesType = ledgerTypeFilter === 'ALL' || tx.type === ledgerTypeFilter;
    const matchesSearch =
      search.trim() === '' ||
      tx.ingredientName.toLowerCase().includes(search.toLowerCase()) ||
      tx.branchName.toLowerCase().includes(search.toLowerCase()) ||
      (tx.referenceId && tx.referenceId.toLowerCase().includes(search.toLowerCase())) ||
      (tx.note && tx.note.toLowerCase().includes(search.toLowerCase()));

    return matchesBranch && matchesType && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="p-4 border border-border shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Tracked Items</span>
            <Package className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold">{stats.totalTrackedItems}</div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Across {stats.activeBranchesCount} active branches
          </span>
        </Card>

        <Card className="p-4 border border-border shadow-xs bg-amber-500/5 dark:bg-amber-500/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Low Stock Items</span>
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-700 dark:text-amber-400">
            {stats.lowStockItems}
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            At or below minimum thresholds
          </span>
        </Card>

        <Card className="p-4 border border-border shadow-xs bg-destructive/5 dark:bg-destructive/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-destructive">Out of Stock</span>
            <XCircle className="h-4 w-4 text-destructive" />
          </div>
          <div className="mt-2 text-2xl font-bold text-destructive">
            {stats.outOfStockItems}
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Immediate reorder required
          </span>
        </Card>

        <Card className="p-4 border border-border shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Today&apos;s Receipts</span>
            <ArrowDownToLine className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {stats.todayReceiptsCount}
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Delivery transactions today
          </span>
        </Card>

        <Card className="p-4 border border-border shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Today&apos;s Losses</span>
            <Trash2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {stats.todayWastageCount}
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Wastage & damage logs today
          </span>
        </Card>
      </div>

      {/* Primary Actions Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 border border-border rounded-lg p-1 bg-muted/40 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('stock')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'stock'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Stock Levels ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ledger')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'ledger'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Stock Ledger & Movements
          </button>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {canCreate && (
            <Button
              size="sm"
              onClick={() => {
                setSelectedItem(null);
                setReceiptOpen(true);
              }}
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
              onClick={() => {
                setSelectedItem(null);
                setWastageOpen(true);
              }}
              className="gap-1.5 text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
              Record Wastage
            </Button>
          )}

          {canTransfer && branches.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedItem(null);
                setTransferOpen(true);
              }}
              className="gap-1.5"
            >
              <ArrowRightLeft className="h-4 w-4" />
              Transfer Stock
            </Button>
          )}

          {canReconcile && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedItem(null);
                setReconcileOpen(true);
              }}
              className="gap-1.5"
            >
              <Scale className="h-4 w-4" />
              Reconcile
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm" className="gap-1.5" />
              }
            >
              More Actions
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {canCreate && (
                <DropdownMenuItem onClick={() => setOpeningOpen(true)} className="gap-2 text-xs">
                  <PackagePlus className="h-4 w-4 text-primary" />
                  Set Opening Stock
                </DropdownMenuItem>
              )}
              {canAdjust && (
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedItem(null);
                    setAdjustmentOpen(true);
                  }}
                  className="gap-2 text-xs"
                >
                  <SlidersHorizontal className="h-4 w-4 text-blue-500" />
                  Manual Adjustment
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search ingredient or branch..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-sm"
            />
          </div>

          {branches.length > 1 && (
            <Select
              value={branchFilter}
              onValueChange={(val) => {
                if (val) setBranchFilter(val);
              }}
            >
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Branches</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {activeTab === 'stock' ? (
            <>
              <Select
                value={healthFilter}
                onValueChange={(val) => {
                  if (val) setHealthFilter(val as 'ALL' | StockHealthStatus);
                }}
              >
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Stock Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Stock Status</SelectItem>
                  <SelectItem value="HEALTHY">Healthy Stock</SelectItem>
                  <SelectItem value="LOW_STOCK">Low Stock</SelectItem>
                  <SelectItem value="OUT_OF_STOCK">Out of Stock</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={statusFilter}
                onValueChange={(val) => {
                  if (val) setStatusFilter(val as 'ALL' | 'ACTIVE' | 'INACTIVE');
                }}
              >
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue placeholder="Tracking" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Items</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </>
          ) : (
            <Select
              value={ledgerTypeFilter}
              onValueChange={(val) => {
                if (val) setLedgerTypeFilter(val);
              }}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Transaction Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                <SelectItem value={StockTransactionType.RECEIPT}>Stock Receipts</SelectItem>
                <SelectItem value={StockTransactionType.OPENING}>Opening Stock</SelectItem>
                <SelectItem value={StockTransactionType.WASTAGE}>Kitchen Wastage</SelectItem>
                <SelectItem value={StockTransactionType.DAMAGE}>Physical Damage</SelectItem>
                <SelectItem value={StockTransactionType.TRANSFER_IN}>Transfer In</SelectItem>
                <SelectItem value={StockTransactionType.TRANSFER_OUT}>Transfer Out</SelectItem>
                <SelectItem value={StockTransactionType.ADJUSTMENT_IN}>Adjustment (In)</SelectItem>
                <SelectItem value={StockTransactionType.ADJUSTMENT_OUT}>Adjustment (Out)</SelectItem>
                <SelectItem value={StockTransactionType.CONSUMPTION}>Recipe Consumption</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Tab 1: Stock Levels */}
      {activeTab === 'stock' && (
        <>
          {filteredItems.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No inventory records found"
              description={
                search || branchFilter !== 'ALL' || healthFilter !== 'ALL'
                  ? 'Try adjusting your search criteria or branch filters.'
                  : 'Start tracking stock by receiving goods or establishing opening inventory.'
              }
              action={
                canCreate
                  ? {
                      label: 'Receive Stock',
                      onClick: () => {
                        setSelectedItem(null);
                        setReceiptOpen(true);
                      },
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
                      <TableHead>Ingredient</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead className="text-right">Current Stock</TableHead>
                      <TableHead className="text-right">Min Stock</TableHead>
                      <TableHead className="text-right">Reorder Level</TableHead>
                      <TableHead className="text-center">Stock Health</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => (
                      <TableRow key={item.id} className="hover:bg-muted/30">
                        <TableCell className="font-semibold text-foreground">
                          <Link
                            href={`/inventory/${item.id}`}
                            className="hover:underline flex items-center gap-1.5"
                          >
                            {item.ingredientName}
                          </Link>
                        </TableCell>

                        <TableCell>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5" />
                            {item.branchName}
                          </span>
                        </TableCell>

                        <TableCell className="text-right">
                          <span
                            className={`font-mono font-bold text-sm ${
                              item.currentStock <= 0
                                ? 'text-destructive'
                                : item.healthStatus === 'LOW_STOCK'
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-foreground'
                            }`}
                          >
                            {item.currentStock} {item.unit}
                          </span>
                        </TableCell>

                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {item.minimumStock} {item.unit}
                        </TableCell>

                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {item.reorderLevel} {item.unit}
                        </TableCell>

                        <TableCell className="text-center">
                          {item.healthStatus === 'HEALTHY' && (
                            <Badge
                              variant="outline"
                              className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-xs"
                            >
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                              Healthy
                            </Badge>
                          )}
                          {item.healthStatus === 'LOW_STOCK' && (
                            <Badge
                              variant="outline"
                              className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-xs"
                            >
                              <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                              Low Stock
                            </Badge>
                          )}
                          {item.healthStatus === 'OUT_OF_STOCK' && (
                            <Badge
                              variant="outline"
                              className="bg-destructive/10 text-destructive border-destructive/20 text-xs"
                            >
                              <XCircle className="mr-1 h-3.5 w-3.5" />
                              Out of Stock
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`/inventory/${item.id}`}
                              className={buttonVariants({
                                variant: 'ghost',
                                size: 'sm',
                                className: 'h-8 px-2 text-xs',
                              })}
                            >
                              History
                            </Link>

                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" />
                                }
                              >
                                <span className="sr-only">Open menu</span>
                                •••
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                {canAdjust && (
                                  <DropdownMenuItem
                                    onClick={() => openAdjustForItem(item)}
                                    className="gap-2 text-xs"
                                  >
                                    <SlidersHorizontal className="h-3.5 w-3.5 text-blue-500" />
                                    Adjust Count
                                  </DropdownMenuItem>
                                )}
                                {canWastage && (
                                  <DropdownMenuItem
                                    onClick={() => openWastageForItem(item)}
                                    className="gap-2 text-xs text-destructive"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Record Wastage
                                  </DropdownMenuItem>
                                )}
                                {canTransfer && branches.length > 1 && (
                                  <DropdownMenuItem
                                    onClick={() => openTransferForItem(item)}
                                    className="gap-2 text-xs"
                                  >
                                    <ArrowRightLeft className="h-3.5 w-3.5 text-indigo-500" />
                                    Transfer Out
                                  </DropdownMenuItem>
                                )}
                                {canReconcile && (
                                  <DropdownMenuItem
                                    onClick={() => openReconcileForItem(item)}
                                    className="gap-2 text-xs"
                                  >
                                    <Scale className="h-3.5 w-3.5 text-purple-500" />
                                    Reconcile Shelf
                                  </DropdownMenuItem>
                                )}
                                {canUpdate && (
                                  <DropdownMenuItem
                                    onClick={() => openConfigForItem(item)}
                                    className="gap-2 text-xs"
                                  >
                                    <Settings2 className="h-3.5 w-3.5" />
                                    Edit Thresholds
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="grid grid-cols-1 gap-3 lg:hidden">
                {filteredItems.map((item) => (
                  <Card key={item.id} className="p-4 border border-border shadow-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/inventory/${item.id}`}
                          className="font-semibold text-foreground hover:underline"
                        >
                          {item.ingredientName}
                        </Link>
                        <span className="text-xs text-muted-foreground block mt-0.5">
                          {item.branchName} ({item.branchCode})
                        </span>
                      </div>

                      {item.healthStatus === 'HEALTHY' && (
                        <Badge variant="outline" className="text-[10px] text-emerald-600 bg-emerald-500/10">
                          Healthy
                        </Badge>
                      )}
                      {item.healthStatus === 'LOW_STOCK' && (
                        <Badge variant="outline" className="text-[10px] text-amber-600 bg-amber-500/10">
                          Low Stock
                        </Badge>
                      )}
                      {item.healthStatus === 'OUT_OF_STOCK' && (
                        <Badge variant="outline" className="text-[10px] text-destructive bg-destructive/10">
                          Out of Stock
                        </Badge>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/50 pt-2.5 text-xs">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Stock</span>
                        <span className="font-mono font-bold">
                          {item.currentStock} {item.unit}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Min Stock</span>
                        <span className="font-mono text-muted-foreground">
                          {item.minimumStock} {item.unit}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Reorder</span>
                        <span className="font-mono text-muted-foreground">
                          {item.reorderLevel} {item.unit}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2">
                      <Link
                        href={`/inventory/${item.id}`}
                        className={buttonVariants({
                          variant: 'outline',
                          size: 'sm',
                          className: 'h-7 px-2.5 text-xs gap-1',
                        })}
                      >
                        History & Details
                        <ChevronRight className="h-3 w-3" />
                      </Link>

                      <div className="flex items-center gap-1">
                        {canAdjust && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openAdjustForItem(item)}
                            className="h-7 px-2 text-xs"
                          >
                            Adjust
                          </Button>
                        )}
                        {canWastage && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openWastageForItem(item)}
                            className="h-7 px-2 text-xs text-destructive"
                          >
                            Wastage
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Tab 2: Stock Ledger / Transactions */}
      {activeTab === 'ledger' && (
        <>
          {filteredTransactions.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No transactions recorded"
              description="Inventory transactions such as receipts, wastage, and transfers will appear in this immutable audit ledger."
            />
          ) : (
            <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Time</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Ingredient</TableHead>
                    <TableHead>Transaction Type</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead>Operator / Performed By</TableHead>
                    <TableHead>Reason / Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((tx) => (
                    <TableRow key={tx.id} className="hover:bg-muted/30">
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap font-mono">
                        {new Date(tx.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>

                      <TableCell className="text-xs font-medium text-foreground">
                        {tx.branchName}
                      </TableCell>

                      <TableCell className="font-semibold text-xs text-foreground">
                        {tx.ingredientName}
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

                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {tx.reasonLabel ? (
                          <span className="font-medium text-foreground mr-1">
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
        </>
      )}

      {/* Global Modals */}
      <StockReceiptDialog
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        branches={branches}
        ingredients={ingredients}
        defaultBranchId={selectedItem?.branchId || (branchFilter !== 'ALL' ? branchFilter : undefined)}
        defaultIngredientId={selectedItem?.ingredientId}
        onSuccess={handleRefresh}
      />

      <WastageDialog
        open={wastageOpen}
        onOpenChange={setWastageOpen}
        branches={branches}
        ingredients={ingredients}
        defaultBranchId={selectedItem?.branchId || (branchFilter !== 'ALL' ? branchFilter : undefined)}
        defaultIngredientId={selectedItem?.ingredientId}
        currentStockHint={selectedItem?.currentStock}
        onSuccess={handleRefresh}
      />

      <StockAdjustmentDialog
        open={adjustmentOpen}
        onOpenChange={setAdjustmentOpen}
        branches={branches}
        ingredients={ingredients}
        defaultBranchId={selectedItem?.branchId || (branchFilter !== 'ALL' ? branchFilter : undefined)}
        defaultIngredientId={selectedItem?.ingredientId}
        currentStockHint={selectedItem?.currentStock}
        onSuccess={handleRefresh}
      />

      <StockTransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        branches={branches}
        ingredients={ingredients}
        defaultSourceBranchId={selectedItem?.branchId || (branchFilter !== 'ALL' ? branchFilter : undefined)}
        defaultIngredientId={selectedItem?.ingredientId}
        currentStockHint={selectedItem?.currentStock}
        onSuccess={handleRefresh}
      />

      <StockReconciliationDialog
        open={reconcileOpen}
        onOpenChange={setReconcileOpen}
        branches={branches}
        ingredients={ingredients}
        defaultBranchId={selectedItem?.branchId || (branchFilter !== 'ALL' ? branchFilter : undefined)}
        defaultIngredientId={selectedItem?.ingredientId}
        currentStockHint={selectedItem?.currentStock ?? 0}
        onSuccess={handleRefresh}
      />

      <OpeningStockDialog
        open={openingOpen}
        onOpenChange={setOpeningOpen}
        branches={branches}
        ingredients={ingredients}
        defaultBranchId={selectedItem?.branchId || (branchFilter !== 'ALL' ? branchFilter : undefined)}
        defaultIngredientId={selectedItem?.ingredientId}
        onSuccess={handleRefresh}
      />

      <InventoryItemDialog
        open={itemConfigOpen}
        onOpenChange={setItemConfigOpen}
        item={selectedItem}
        onSuccess={handleRefresh}
      />
    </div>
  );
}
