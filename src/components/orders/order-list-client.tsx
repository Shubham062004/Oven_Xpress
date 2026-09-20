'use client';

import { useState, useCallback, useRef, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Utensils,
  Ban,
  Building2,
  Clock,
  User,
  ShoppingBag,
  Truck,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  ChefHat,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { OrderType, OrderStatus } from '@prisma/client';

import { useAuth } from '@/providers/auth-provider';
import { hasPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getOrders, getOrderStats, updateOrderStatus } from '@/lib/orders/actions';
import type { OrderListItem, OrderStats } from '@/lib/orders/types';

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
import { OrderCancelDialog } from '@/components/orders/order-cancel-dialog';
import { TableManagementDialog } from '@/components/orders/table-management-dialog';

interface BranchOption {
  id: string;
  name: string;
  code: string;
}

interface OrderListClientProps {
  initialOrders: OrderListItem[];
  initialStats: OrderStats;
  initialPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  branches: BranchOption[];
  userBranchId?: string | null;
}

export function OrderListClient({
  initialOrders,
  initialStats,
  initialPagination,
  branches,
  userBranchId,
}: OrderListClientProps) {
  const router = useRouter();
  const user = useAuth();
  const [, startTransition] = useTransition();

  const canCreate = hasPermission(user, PERMISSIONS.ORDER_CREATE);
  const canUpdate = hasPermission(user, PERMISSIONS.ORDER_UPDATE);
  const canChangeStatus = hasPermission(user, PERMISSIONS.ORDER_STATUS);
  const canCancel = hasPermission(user, PERMISSIONS.ORDER_CANCEL);
  const canManageTables = hasPermission(user, PERMISSIONS.TABLE_READ);

  const [orders, setOrders] = useState<OrderListItem[]>(initialOrders);
  const [stats, setStats] = useState<OrderStats>(initialStats);
  const [pagination, setPagination] = useState(initialPagination);
  const [isLoading, setIsLoading] = useState(false);

  // Filter States (defaults to today's orders)
  const [selectedBranch, setSelectedBranch] = useState<string>(userBranchId || 'ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<'today' | 'all'>('today');
  const [search, setSearch] = useState<string>('');

  // Dialog states
  const [cancelDialogOrder, setCancelDialogOrder] = useState<{
    id: string;
    orderNumber: string;
  } | null>(null);
  const [isTablesOpen, setIsTablesOpen] = useState(false);
  const activeBranchIdForTables =
    selectedBranch !== 'ALL' ? selectedBranch : userBranchId || (branches.length > 0 ? branches[0].id : '');
  const activeBranchNameForTables =
    branches.find((b) => b.id === activeBranchIdForTables)?.name || 'Branch Tables';

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchOrders = useCallback(
    async (
      page: number = 1,
      overrides?: {
        branch?: string;
        type?: string;
        status?: string;
        date?: 'today' | 'all';
        search?: string;
      }
    ) => {
      setIsLoading(true);
      try {
        const branchVal = overrides?.branch !== undefined ? overrides.branch : selectedBranch;
        const typeVal = overrides?.type !== undefined ? overrides.type : selectedType;
        const statusVal = overrides?.status !== undefined ? overrides.status : selectedStatus;
        const dateVal = overrides?.date !== undefined ? overrides.date : dateFilter;
        const searchVal = overrides?.search !== undefined ? overrides.search : search;

        const todayStr = new Date().toISOString().split('T')[0];

        const [ordersRes, statsRes] = await Promise.all([
          getOrders({
            branchId: branchVal === 'ALL' ? undefined : branchVal,
            orderType: typeVal === 'ALL' ? undefined : (typeVal as OrderType),
            status: statusVal === 'ALL' ? undefined : (statusVal as OrderStatus),
            search: searchVal.trim() || undefined,
            startDate: dateVal === 'today' ? todayStr : undefined,
            endDate: dateVal === 'today' ? todayStr : undefined,
            page,
            limit: 20,
          }),
          getOrderStats(branchVal === 'ALL' ? undefined : branchVal),
        ]);

        if (ordersRes.success && ordersRes.data) {
          setOrders(ordersRes.data.orders);
          setPagination(ordersRes.data.pagination);
        } else {
          toast.error(ordersRes.error || 'Failed to fetch orders');
        }

        if (statsRes.success && statsRes.data) {
          setStats(statsRes.data);
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to load orders');
      } finally {
        setIsLoading(false);
      }
    },
    [selectedBranch, selectedType, selectedStatus, search, dateFilter]
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchOrders(1, { search: value });
    }, 300);
  };

  const handleBranchFilter = (val: string) => {
    setSelectedBranch(val);
    fetchOrders(1, { branch: val });
  };

  const handleTypeFilter = (val: string) => {
    setSelectedType(val);
    fetchOrders(1, { type: val });
  };

  const handleStatusFilter = (val: string) => {
    setSelectedStatus(val);
    fetchOrders(1, { status: val });
  };

  const handleDateFilter = (val: 'today' | 'all') => {
    setDateFilter(val);
    fetchOrders(1, { date: val });
  };

  const handleQuickStatus = (orderId: string, nextStatus: OrderStatus) => {
    startTransition(async () => {
      const res = await updateOrderStatus(orderId, nextStatus);
      if (res.success) {
        toast.success(`Order moved to ${nextStatus}`);
        fetchOrders(pagination.page);
      } else {
        toast.error(res.error || 'Failed to update order status');
      }
    });
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.PENDING:
        return (
          <Badge className="bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30">
            Pending
          </Badge>
        );
      case OrderStatus.CONFIRMED:
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30">
            Confirmed
          </Badge>
        );
      case OrderStatus.PREPARING:
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
            Preparing
          </Badge>
        );
      case OrderStatus.READY:
        return (
          <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30">
            Ready
          </Badge>
        );
      case OrderStatus.COMPLETED:
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
            Completed
          </Badge>
        );
      case OrderStatus.CANCELLED:
        return (
          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30">
            Cancelled
          </Badge>
        );
      case OrderStatus.REFUNDED:
        return (
          <Badge className="bg-zinc-500/15 text-zinc-700 dark:text-zinc-400 border-zinc-500/30">
            Refunded
          </Badge>
        );
    }
  };

  const getTypeBadge = (type: OrderType, tableNumber: string | null) => {
    switch (type) {
      case OrderType.DINE_IN:
        return (
          <Badge variant="outline" className="gap-1 font-medium bg-background">
            <Utensils className="size-3 text-primary" />
            Dine-in {tableNumber ? `• ${tableNumber}` : ''}
          </Badge>
        );
      case OrderType.TAKEAWAY:
        return (
          <Badge variant="outline" className="gap-1 font-medium bg-background">
            <ShoppingBag className="size-3 text-amber-600" />
            Takeaway
          </Badge>
        );
      case OrderType.DELIVERY:
        return (
          <Badge variant="outline" className="gap-1 font-medium bg-background">
            <Truck className="size-3 text-blue-600" />
            Delivery
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Order Management"
        description="Live order operations, dine-in tables, takeaway fulfillment, and direct delivery dispatch."
      >
        <div className="flex flex-wrap items-center gap-2">
          {canManageTables && (
            <Button
              variant="outline"
              onClick={() => setIsTablesOpen(true)}
              className="gap-2 shadow-xs"
            >
              <Utensils className="size-4" />
              Dining Tables
            </Button>
          )}

          {canCreate && (
            <Link
              href="/orders/new"
              className={buttonVariants({ className: 'gap-2 shadow-sm' })}
            >
              <Plus className="size-4" />
              New Order
            </Link>
          )}
        </div>
      </PageHeader>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-1.5 pt-4 px-4">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Today&apos;s Orders
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {stats.todayOrders}
              </span>
              <ShoppingCart className="size-4 text-muted-foreground" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Placed today</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-1.5 pt-4 px-4">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Active / In Prep
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
                {stats.activeOrders}
              </span>
              <AlertCircle className="size-4 text-blue-600" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Pending & confirmed</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-1.5 pt-4 px-4">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Kitchen & Ready
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold tracking-tight text-purple-600 dark:text-purple-400">
                {stats.preparingOrders}
              </span>
              <ChefHat className="size-4 text-purple-600" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Cooking or ready to serve</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-1.5 pt-4 px-4">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Completed Today
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {stats.completedToday}
              </span>
              <CheckCircle2 className="size-4 text-emerald-600" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Fulfilled successfully</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs col-span-2 sm:col-span-1">
          <CardHeader className="pb-1.5 pt-4 px-4">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Today&apos;s Revenue
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                ${stats.todayRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
              <DollarSign className="size-4 text-muted-foreground" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">From completed orders</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters Bar */}
      <Card className="border-border/60 shadow-xs">
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by order #, customer name, or phone..."
                value={search}
                onChange={handleSearchChange}
                className="pl-9 text-sm"
              />
            </div>

            {/* Date filter toggle */}
            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/50 shrink-0">
              <button
                type="button"
                onClick={() => handleDateFilter('today')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  dateFilter === 'today'
                    ? 'bg-background shadow-xs text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Today&apos;s Orders
              </button>
              <button
                type="button"
                onClick={() => handleDateFilter('all')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  dateFilter === 'all'
                    ? 'bg-background shadow-xs text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All Dates
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40">
            {/* Branch Filter (hidden if manager locked) */}
            {branches.length > 1 && !userBranchId && (
              <Select value={selectedBranch} onValueChange={(val) => { if (val) handleBranchFilter(val); }}>
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue placeholder="All Branches" />
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

            {/* Order Type Filter */}
            <Select value={selectedType} onValueChange={(val) => { if (val) handleTypeFilter(val); }}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                <SelectItem value={OrderType.DINE_IN}>Dine-in</SelectItem>
                <SelectItem value={OrderType.TAKEAWAY}>Takeaway</SelectItem>
                <SelectItem value={OrderType.DELIVERY}>Delivery</SelectItem>
              </SelectContent>
            </Select>

            {/* Order Status Filter */}
            <Select value={selectedStatus} onValueChange={(val) => { if (val) handleStatusFilter(val); }}>
              <SelectTrigger className="w-[150px] h-8 text-xs">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value={OrderStatus.PENDING}>Pending</SelectItem>
                <SelectItem value={OrderStatus.CONFIRMED}>Confirmed</SelectItem>
                <SelectItem value={OrderStatus.PREPARING}>Preparing</SelectItem>
                <SelectItem value={OrderStatus.READY}>Ready</SelectItem>
                <SelectItem value={OrderStatus.COMPLETED}>Completed</SelectItem>
                <SelectItem value={OrderStatus.CANCELLED}>Cancelled</SelectItem>
              </SelectContent>
            </Select>

            {(selectedBranch !== 'ALL' || selectedType !== 'ALL' || selectedStatus !== 'ALL' || search || dateFilter !== 'today') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedBranch(userBranchId || 'ALL');
                  setSelectedType('ALL');
                  setSelectedStatus('ALL');
                  setDateFilter('today');
                  setSearch('');
                }}
                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground ml-auto"
              >
                Reset Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card className="border-border/60 shadow-xs">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6">
              <TableSkeleton columns={7} rows={6} />
            </div>
          ) : orders.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={ShoppingCart}
                title="No orders found"
                description={
                  search || selectedStatus !== 'ALL' || selectedType !== 'ALL'
                    ? 'No orders match your filter criteria. Try adjusting or clearing filters.'
                    : dateFilter === 'today'
                    ? 'No orders have been recorded today yet.'
                    : 'No orders exist in the system yet.'
                }
                action={
                  canCreate
                    ? {
                        label: 'Create First Order',
                        onClick: () => router.push('/orders/new'),
                      }
                    : undefined
                }
              />
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[140px]">Order #</TableHead>
                      <TableHead>Type & Seating</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead className="text-center">Items</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((ord) => (
                      <TableRow key={ord.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="font-semibold text-sm">
                          <Link
                            href={`/orders/${ord.id}`}
                            className="hover:underline text-primary flex items-center gap-1.5"
                          >
                            {ord.orderNumber}
                          </Link>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="size-3" />
                            {new Date(ord.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </TableCell>

                        <TableCell>
                          {getTypeBadge(ord.orderType, ord.tableNumber)}
                        </TableCell>

                        <TableCell>
                          {ord.customerName ? (
                            <div>
                              <div className="font-medium text-xs text-foreground flex items-center gap-1">
                                <User className="size-3 text-muted-foreground" />
                                {ord.customerName}
                              </div>
                              {ord.customerPhone && (
                                <div className="text-[11px] text-muted-foreground">
                                  {ord.customerPhone}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Guest Diner</span>
                          )}
                        </TableCell>

                        <TableCell className="text-xs">
                          <div className="font-medium flex items-center gap-1 text-foreground">
                            <Building2 className="size-3 text-muted-foreground" />
                            {ord.branchName}
                          </div>
                          <div className="text-[11px] text-muted-foreground">{ord.branchCode}</div>
                        </TableCell>

                        <TableCell className="text-center text-xs">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-muted font-medium">
                            {ord.itemCount} items
                          </span>
                        </TableCell>

                        <TableCell className="text-right font-semibold text-sm">
                          ${ord.totalAmount.toFixed(2)}
                        </TableCell>

                        <TableCell>{getStatusBadge(ord.status)}</TableCell>

                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button variant="ghost" size="icon-sm" aria-label="Order actions">
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              }
                            />
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem render={<Link href={`/orders/${ord.id}`} />}>
                                <Eye className="mr-2 size-4" />
                                View Details
                              </DropdownMenuItem>

                              {canChangeStatus && ord.status === OrderStatus.PENDING && (
                                <DropdownMenuItem onClick={() => handleQuickStatus(ord.id, OrderStatus.CONFIRMED)}>
                                  <CheckCircle2 className="mr-2 size-4 text-blue-600" />
                                  Confirm Order
                                </DropdownMenuItem>
                              )}

                              {canChangeStatus && ord.status === OrderStatus.CONFIRMED && (
                                <DropdownMenuItem onClick={() => handleQuickStatus(ord.id, OrderStatus.PREPARING)}>
                                  <ChefHat className="mr-2 size-4 text-amber-600" />
                                  Start Preparing
                                </DropdownMenuItem>
                              )}

                              {canChangeStatus && ord.status === OrderStatus.PREPARING && (
                                <DropdownMenuItem onClick={() => handleQuickStatus(ord.id, OrderStatus.READY)}>
                                  <CheckCircle2 className="mr-2 size-4 text-purple-600" />
                                  Mark Ready
                                </DropdownMenuItem>
                              )}

                              {canChangeStatus && ord.status === OrderStatus.READY && (
                                <DropdownMenuItem onClick={() => handleQuickStatus(ord.id, OrderStatus.COMPLETED)}>
                                  <CheckCircle2 className="mr-2 size-4 text-emerald-600" />
                                  Complete Order
                                </DropdownMenuItem>
                              )}

                              {canCancel &&
                                ord.status !== OrderStatus.COMPLETED &&
                                ord.status !== OrderStatus.CANCELLED &&
                                ord.status !== OrderStatus.REFUNDED && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() =>
                                        setCancelDialogOrder({
                                          id: ord.id,
                                          orderNumber: ord.orderNumber,
                                        })
                                      }
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Ban className="mr-2 size-4 text-destructive" />
                                      Cancel Order
                                    </DropdownMenuItem>
                                  </>
                                )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card List */}
              <div className="md:hidden divide-y divide-border/60">
                {orders.map((ord) => (
                  <div key={ord.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between">
                      <div>
                        <Link
                          href={`/orders/${ord.id}`}
                          className="font-semibold text-sm text-primary hover:underline"
                        >
                          {ord.orderNumber}
                        </Link>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                          <Clock className="size-3" />
                          {new Date(ord.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          <span>•</span>
                          <span>{ord.branchName}</span>
                        </div>
                      </div>
                      {getStatusBadge(ord.status)}
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <div>{getTypeBadge(ord.orderType, ord.tableNumber)}</div>
                      <div className="font-bold text-sm text-foreground">
                        ${ord.totalAmount.toFixed(2)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                      <div className="text-muted-foreground">
                        {ord.customerName ? ord.customerName : 'Guest'} • {ord.itemCount} items
                      </div>
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/orders/${ord.id}`}
                          className={buttonVariants({
                            variant: 'ghost',
                            size: 'sm',
                            className: 'h-8 px-2 text-xs',
                          })}
                        >
                          Details
                        </Link>
                        {canCancel &&
                          ord.status !== OrderStatus.COMPLETED &&
                          ord.status !== OrderStatus.CANCELLED && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setCancelDialogOrder({
                                  id: ord.id,
                                  orderNumber: ord.orderNumber,
                                })
                              }
                              className="h-8 px-2 text-xs text-destructive hover:text-destructive"
                            >
                              Cancel
                            </Button>
                          )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination Bar */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 text-xs text-muted-foreground">
                  <div>
                    Showing page <span className="font-medium text-foreground">{pagination.page}</span> of{' '}
                    <span className="font-medium text-foreground">{pagination.totalPages}</span> ({pagination.total} total)
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchOrders(pagination.page - 1)}
                      disabled={pagination.page <= 1 || isLoading}
                      className="h-7 px-2"
                    >
                      <ChevronLeft className="size-3.5" />
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchOrders(pagination.page + 1)}
                      disabled={pagination.page >= pagination.totalPages || isLoading}
                      className="h-7 px-2"
                    >
                      Next
                      <ChevronRight className="size-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Cancellation Dialog */}
      {cancelDialogOrder && (
        <OrderCancelDialog
          open={!!cancelDialogOrder}
          onOpenChange={(open) => !open && setCancelDialogOrder(null)}
          orderId={cancelDialogOrder.id}
          orderNumber={cancelDialogOrder.orderNumber}
          onSuccess={() => fetchOrders(pagination.page)}
        />
      )}

      {/* Table Management Dialog */}
      {isTablesOpen && (
        <TableManagementDialog
          open={isTablesOpen}
          onOpenChange={setIsTablesOpen}
          branchId={activeBranchIdForTables}
          branchName={activeBranchNameForTables}
          canManage={canUpdate}
        />
      )}
    </div>
  );
}
