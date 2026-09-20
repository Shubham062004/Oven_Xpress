'use client';

import { useState, useCallback, useEffect, useRef, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShoppingBag,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  PackageCheck,
  Ban,
  Building2,
  Truck,
  Calendar,
  Clock,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { PurchaseOrderStatus } from '@prisma/client';

import { useAuth } from '@/providers/auth-provider';
import { hasPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getPurchases, getPurchaseStats } from '@/lib/purchases/actions';
import type { PurchaseOrderListItem, PurchaseStats } from '@/lib/purchases/types';

import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { PurchaseCancelDialog } from '@/components/purchases/purchase-cancel-dialog';

interface BranchOption {
  id: string;
  name: string;
  code: string;
}

interface SupplierOption {
  id: string;
  name: string;
}

interface PurchaseListClientProps {
  initialPurchases: PurchaseOrderListItem[];
  initialStats: PurchaseStats;
  branches: BranchOption[];
  suppliers: SupplierOption[];
  isManager: boolean;
  userBranchId?: string | null;
}

export function PurchaseListClient({
  initialPurchases,
  initialStats,
  branches,
  suppliers,
  isManager,
  userBranchId,
}: PurchaseListClientProps) {
  const router = useRouter();
  const user = useAuth();
  const [isPending, startTransition] = useTransition();

  const [purchases, setPurchases] = useState<PurchaseOrderListItem[]>(initialPurchases);
  const [stats, setStats] = useState<PurchaseStats>(initialStats);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>(
    isManager && userBranchId ? userBranchId : 'ALL'
  );
  const [supplierFilter, setSupplierFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Dialogs
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrderListItem | null>(null);

  const canCreate = hasPermission(user, PERMISSIONS.PURCHASE_CREATE);
  const canReceive = hasPermission(user, PERMISSIONS.PURCHASE_RECEIVE);
  const canCancel = hasPermission(user, PERMISSIONS.PURCHASE_CANCEL);

  const fetchFilteredPurchases = useCallback(
    (search?: string, bId?: string, sId?: string, st?: string) => {
      startTransition(async () => {
        const [purchasesRes, statsRes] = await Promise.all([
          getPurchases({
            search: search || undefined,
            branchId: bId === 'ALL' ? undefined : bId,
            supplierId: sId === 'ALL' ? undefined : sId,
            status: st === 'ALL' ? undefined : (st as PurchaseOrderStatus),
          }),
          getPurchaseStats(bId === 'ALL' ? undefined : bId),
        ]);

        if (purchasesRes.success && purchasesRes.data) {
          setPurchases(purchasesRes.data);
        } else if (purchasesRes.error) {
          toast.error(purchasesRes.error);
        }

        if (statsRes.success && statsRes.data) {
          setStats(statsRes.data);
        }
      });
    },
    []
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchFilteredPurchases(value, branchFilter, supplierFilter, statusFilter);
    }, 300);
  };

  const handleBranchChange = (val: string | null) => {
    const nextBranch = val ?? 'ALL';
    setBranchFilter(nextBranch);
    fetchFilteredPurchases(searchQuery, nextBranch, supplierFilter, statusFilter);
  };

  const handleSupplierChange = (val: string | null) => {
    const nextSupplier = val ?? 'ALL';
    setSupplierFilter(nextSupplier);
    fetchFilteredPurchases(searchQuery, branchFilter, nextSupplier, statusFilter);
  };

  const handleStatusChange = (val: string | null) => {
    const nextStatus = val ?? 'ALL';
    setStatusFilter(nextStatus);
    fetchFilteredPurchases(searchQuery, branchFilter, supplierFilter, nextStatus);
  };

  const handleOpenCancel = (po: PurchaseOrderListItem) => {
    setSelectedPO(po);
    setCancelDialogOpen(true);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const getStatusBadge = (st: PurchaseOrderStatus) => {
    switch (st) {
      case PurchaseOrderStatus.RECEIVED:
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
            Received
          </Badge>
        );
      case PurchaseOrderStatus.PARTIALLY_RECEIVED:
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
            Partially Received
          </Badge>
        );
      case PurchaseOrderStatus.ORDERED:
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30">
            Ordered
          </Badge>
        );
      case PurchaseOrderStatus.DRAFT:
        return <Badge variant="secondary">Draft</Badge>;
      case PurchaseOrderStatus.CANCELLED:
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{st}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Purchase Orders"
        description="Manage procurement, vendor order fulfillment, and receiving stock into branch inventory."
      >
        {canCreate && (
          <Link
            href="/purchases/new"
            className={buttonVariants({ className: 'gap-2 shadow-sm' })}
          >
            <Plus className="size-4" />
            New Purchase Order
          </Link>
        )}
      </PageHeader>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-1.5 pt-4 px-4">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Orders
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Across branches</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-1.5 pt-4 px-4">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Awaiting Delivery
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {stats.orderedOrders}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Confirmed & dispatched</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-1.5 pt-4 px-4">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Partially Received
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {stats.partiallyReceivedOrders}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Pending deliveries</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-1.5 pt-4 px-4">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Fully Received
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.receivedOrders}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">In stock ledger</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs col-span-2 sm:col-span-1">
          <CardHeader className="pb-1.5 pt-4 px-4">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Spend
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl sm:text-2xl font-bold text-foreground truncate">
              ₹{stats.totalSpend.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Non-cancelled orders</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search PO #, supplier, branch..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="pl-9 h-10"
          />
        </div>

        {/* Branch Filter (hidden for manager since branch is locked) */}
        {!isManager ? (
          <div>
            <Select value={branchFilter} onValueChange={handleBranchChange}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Branch: All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Branches</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="flex items-center px-3 py-2 rounded-md border border-border/60 bg-muted/30 text-xs text-muted-foreground">
            <Building2 className="size-4 mr-2 text-primary" />
            <span className="truncate">
              Branch: {branches.find((b) => b.id === userBranchId)?.name || 'Assigned Branch'}
            </span>
          </div>
        )}

        {/* Supplier Filter */}
        <div>
          <Select value={supplierFilter} onValueChange={handleSupplierChange}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Supplier: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Suppliers</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status Filter */}
        <div>
          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Status: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value={PurchaseOrderStatus.ORDERED}>Ordered (Awaiting)</SelectItem>
              <SelectItem value={PurchaseOrderStatus.PARTIALLY_RECEIVED}>Partially Received</SelectItem>
              <SelectItem value={PurchaseOrderStatus.RECEIVED}>Received (Complete)</SelectItem>
              <SelectItem value={PurchaseOrderStatus.DRAFT}>Draft</SelectItem>
              <SelectItem value={PurchaseOrderStatus.CANCELLED}>Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Orders Table Card */}
      <Card className="border-border/60 shadow-xs overflow-hidden">
        {isPending ? (
          <div className="p-6">
            <TableSkeleton rows={6} columns={7} />
          </div>
        ) : purchases.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={ShoppingBag}
              title="No purchase orders found"
              description={
                searchQuery || branchFilter !== 'ALL' || supplierFilter !== 'ALL' || statusFilter !== 'ALL'
                  ? 'No purchase orders match your active search filters.'
                  : 'Start ordering ingredients and materials to maintain branch stock.'
              }
              action={
                canCreate
                  ? {
                      label: 'Create First Purchase Order',
                      onClick: () => router.push('/purchases/new'),
                    }
                  : undefined
              }
            />
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Purchase #</TableHead>
                    <TableHead className="font-semibold">Supplier</TableHead>
                    <TableHead className="font-semibold">Destination Branch</TableHead>
                    <TableHead className="font-semibold">Order / Expected Date</TableHead>
                    <TableHead className="font-semibold">Fulfillment</TableHead>
                    <TableHead className="text-right font-semibold">Total Amount</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="text-right font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map((po) => {
                    const isReceivable =
                      po.status === PurchaseOrderStatus.ORDERED ||
                      po.status === PurchaseOrderStatus.PARTIALLY_RECEIVED;
                    const isCancellable =
                      po.status === PurchaseOrderStatus.DRAFT ||
                      (po.status === PurchaseOrderStatus.ORDERED && po.totalReceivedQuantity === 0);

                    return (
                      <TableRow key={po.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium">
                          <Link
                            href={`/purchases/${po.id}`}
                            className="font-mono text-xs hover:underline hover:text-primary transition-colors flex items-center gap-1.5"
                          >
                            <ShoppingBag className="size-3.5 text-muted-foreground" />
                            {po.purchaseNumber}
                          </Link>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <User className="size-3" />
                            {po.createdBy}
                          </span>
                        </TableCell>

                        <TableCell>
                          <Link
                            href={`/suppliers/${po.supplierId}`}
                            className="text-sm font-medium hover:underline hover:text-primary transition-colors flex items-center gap-1.5"
                          >
                            <Truck className="size-3.5 text-muted-foreground" />
                            {po.supplierName}
                          </Link>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm text-foreground">
                            <Building2 className="size-3.5 text-muted-foreground" />
                            {po.branchName}
                          </div>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {po.branchCode}
                          </span>
                        </TableCell>

                        <TableCell>
                          <div className="text-xs text-foreground flex items-center gap-1.5">
                            <Calendar className="size-3 text-muted-foreground" />
                            {new Date(po.orderDate).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                          {po.expectedDate && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Clock className="size-3" />
                              Exp:{' '}
                              {new Date(po.expectedDate).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                              })}
                            </span>
                          )}
                        </TableCell>

                        <TableCell>
                          <div className="text-xs font-medium">
                            {po.totalReceivedQuantity} / {po.totalOrderedQuantity}
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            {po.itemsCount} {po.itemsCount === 1 ? 'ingredient' : 'ingredients'}
                          </span>
                        </TableCell>

                        <TableCell className="text-right font-semibold text-sm">
                          ₹{po.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>

                        <TableCell>{getStatusBadge(po.status)}</TableCell>

                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button variant="ghost" size="icon-sm" aria-label="Purchase actions">
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              }
                            />
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem render={<Link href={`/purchases/${po.id}`} />}>
                                <Eye className="mr-2 size-4" />
                                View Details
                              </DropdownMenuItem>

                              {canReceive && isReceivable && (
                                <DropdownMenuItem render={<Link href={`/purchases/${po.id}`} />}>
                                  <PackageCheck className="mr-2 size-4 text-emerald-600" />
                                  Receive Stock
                                </DropdownMenuItem>
                              )}

                              {canCancel && isCancellable && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleOpenCancel(po)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Ban className="mr-2 size-4" />
                                    Cancel Order
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-border/60">
              {purchases.map((po) => {
                const isReceivable =
                  po.status === PurchaseOrderStatus.ORDERED ||
                  po.status === PurchaseOrderStatus.PARTIALLY_RECEIVED;
                const isCancellable =
                  po.status === PurchaseOrderStatus.DRAFT ||
                  (po.status === PurchaseOrderStatus.ORDERED && po.totalReceivedQuantity === 0);

                return (
                  <div key={po.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/purchases/${po.id}`}
                          className="font-mono text-sm font-semibold hover:text-primary transition-colors flex items-center gap-1.5"
                        >
                          <ShoppingBag className="size-4 text-muted-foreground" />
                          {po.purchaseNumber}
                        </Link>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Truck className="size-3" />
                          {po.supplierName}
                        </p>
                      </div>
                      {getStatusBadge(po.status)}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1 border-t border-border/40">
                      <div>
                        <span className="text-[11px] block">Branch:</span>
                        <span className="font-medium text-foreground">{po.branchName}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] block">Total Amount:</span>
                        <span className="font-semibold text-foreground">
                          ₹{po.totalAmount.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] block">Ordered:</span>
                        <span>{new Date(po.orderDate).toLocaleDateString('en-IN')}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] block">Fulfillment:</span>
                        <span>
                          {po.totalReceivedQuantity} / {po.totalOrderedQuantity}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                      <Link
                        href={`/purchases/${po.id}`}
                        className={buttonVariants({
                          variant: 'ghost',
                          size: 'sm',
                          className: 'h-8 text-xs',
                        })}
                      >
                        View Order
                      </Link>
                      {canReceive && isReceivable && (
                        <Link
                          href={`/purchases/${po.id}`}
                          className={buttonVariants({
                            variant: 'ghost',
                            size: 'sm',
                            className: 'h-8 text-xs text-emerald-600',
                          })}
                        >
                          Receive
                        </Link>
                      )}
                      {canCancel && isCancellable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-destructive hover:text-destructive"
                          onClick={() => handleOpenCancel(po)}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {/* Cancel Dialog */}
      {selectedPO && (
        <PurchaseCancelDialog
          open={cancelDialogOpen}
          onOpenChange={setCancelDialogOpen}
          purchaseOrderId={selectedPO.id}
          purchaseNumber={selectedPO.purchaseNumber}
          onSuccess={() =>
            fetchFilteredPurchases(searchQuery, branchFilter, supplierFilter, statusFilter)
          }
        />
      )}
    </div>
  );
}
