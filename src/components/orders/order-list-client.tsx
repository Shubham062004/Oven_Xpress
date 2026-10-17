'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart,
  Plus,
  Search,
  Eye,
  Utensils,
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
  Pencil,
  Trash2,
  Filter,
  Check,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { OrderType, OrderStatus } from '@prisma/client';

import { useAuth } from '@/providers/auth-provider';
import { hasPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getOrders, getOrderStats } from '@/lib/orders/actions';
import type { OrderListItem, OrderStats } from '@/lib/orders/types';
import { useRealtime } from '@/lib/realtime/use-realtime';
import type { OrderCreatedPayload } from '@/lib/realtime/types';

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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { OrderCancelDialog } from '@/components/orders/order-cancel-dialog';
import { OrderEditDialog } from '@/components/orders/order-edit-dialog';
import { TableManagementDialog } from '@/components/orders/table-management-dialog';

// ─── Types & Sorting ────────────────────────────────────────────────────────

type OrderSortColumn =
  | 'orderNumber'
  | 'type'
  | 'customer'
  | 'branch'
  | 'items'
  | 'total'
  | 'status';

type SortDirection = 'asc' | 'desc';

function SortIndicator({
  column,
  currentColumn,
  direction,
}: {
  column: OrderSortColumn;
  currentColumn: OrderSortColumn | null;
  direction: SortDirection;
}) {
  if (currentColumn !== column) {
    return <ArrowUpDown className="size-3.5 text-muted-foreground/30 shrink-0" />;
  }
  return direction === 'asc' ? (
    <ArrowUp className="size-3.5 text-primary shrink-0" />
  ) : (
    <ArrowDown className="size-3.5 text-primary shrink-0" />
  );
}

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

  const canCreate = hasPermission(user, PERMISSIONS.ORDER_CREATE);
  const canUpdate = hasPermission(user, PERMISSIONS.ORDER_UPDATE);
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

  // Sorting State
  const [sortColumn, setSortColumn] = useState<OrderSortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Dialog states
  const [cancelDialogOrder, setCancelDialogOrder] = useState<{
    id: string;
    orderNumber: string;
  } | null>(null);
  const [editDialogOrder, setEditDialogOrder] = useState<{
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

  // Subscribe to live order updates
  useRealtime({
    branchId: selectedBranch !== 'ALL' ? selectedBranch : userBranchId || undefined,
    eventTypes: ['order:created', 'order:status_changed', 'payment:updated'],
    onEvent: (msg) => {
      if (msg.type === 'order:created') {
        const payload = msg.payload as OrderCreatedPayload;
        toast.info(`New Order ${payload.orderNumber} received (₹${payload.totalAmount})`);
        fetchOrders(pagination.page);
      } else if (msg.type === 'order:status_changed' || msg.type === 'payment:updated') {
        fetchOrders(pagination.page);
      }
    },
  });

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

  // Sorting Handler
  const handleSort = (column: OrderSortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Row Action Handlers
  const handleEditOrder = (ord: OrderListItem) => {
    if (ord.status !== OrderStatus.PENDING) {
      toast.error(
        `Cannot edit order ${ord.orderNumber}. Only PENDING orders can be edited (current status: ${ord.status}).`
      );
      return;
    }
    setEditDialogOrder({ id: ord.id, orderNumber: ord.orderNumber });
  };

  const handleDeleteOrder = (ord: OrderListItem) => {
    if (
      ord.status === OrderStatus.COMPLETED ||
      ord.status === OrderStatus.CANCELLED ||
      ord.status === OrderStatus.REFUNDED
    ) {
      toast.error(
        `Order ${ord.orderNumber} is ${ord.status.toLowerCase()} and cannot be cancelled or deleted.`
      );
      return;
    }
    setCancelDialogOrder({ id: ord.id, orderNumber: ord.orderNumber });
  };

  // Memoized Sorted Orders
  const sortedOrders = useMemo(() => {
    if (!sortColumn) return orders;
    const list = [...orders];
    return list.sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case 'orderNumber': {
          comparison = a.orderNumber.localeCompare(b.orderNumber);
          break;
        }
        case 'type': {
          const typeA = `${a.orderType} ${a.tableNumber || ''}`.trim();
          const typeB = `${b.orderType} ${b.tableNumber || ''}`.trim();
          comparison = typeA.localeCompare(typeB);
          break;
        }
        case 'customer': {
          const nameA = (a.customerName || '').trim().toLowerCase();
          const nameB = (b.customerName || '').trim().toLowerCase();
          comparison = nameA.localeCompare(nameB);
          break;
        }
        case 'branch': {
          const branchA = a.branchName.trim().toLowerCase();
          const branchB = b.branchName.trim().toLowerCase();
          comparison = branchA.localeCompare(branchB);
          break;
        }
        case 'items': {
          comparison = a.itemCount - b.itemCount;
          break;
        }
        case 'total': {
          comparison = a.totalAmount - b.totalAmount;
          break;
        }
        case 'status': {
          comparison = a.status.localeCompare(b.status);
          break;
        }
      }

      if (comparison === 0) {
        comparison = b.createdAt.localeCompare(a.createdAt);
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [orders, sortColumn, sortDirection]);

  const hasActiveFilters =
    selectedBranch !== (userBranchId || 'ALL') ||
    selectedType !== 'ALL' ||
    selectedStatus !== 'ALL';

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
                ${stats.todayRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
              <DollarSign className="size-4 text-muted-foreground" aria-label="Revenue" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">From completed orders</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Date Controls Bar (Three dropdowns removed, space cleaned up) */}
      <Card className="border-border/60 shadow-xs">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by order #, customer name, or phone..."
                value={search}
                onChange={handleSearchChange}
                className="pl-9 text-sm w-full"
              />
            </div>

            {/* Date filter toggle */}
            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/50 shrink-0 w-full sm:w-auto justify-center">
              <button
                type="button"
                onClick={() => handleDateFilter('today')}
                className={`flex-1 sm:flex-initial px-3 py-1.5 min-h-9 text-xs font-medium rounded-md transition-all cursor-pointer ${
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
                className={`flex-1 sm:flex-initial px-3 py-1.5 min-h-9 text-xs font-medium rounded-md transition-all cursor-pointer ${
                  dateFilter === 'all'
                    ? 'bg-background shadow-xs text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All Dates
              </button>
            </div>
          </div>

          {/* Active filter summary pill bar (visible when column filters applied) */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 pt-2.5 mt-2.5 border-t border-border/40 text-xs">
              <span className="text-muted-foreground text-[11px] font-medium">Active filters:</span>
              {selectedType !== 'ALL' && (
                <Badge variant="secondary" className="gap-1 text-[11px] font-normal">
                  Type: {selectedType}
                  <button
                    type="button"
                    onClick={() => handleTypeFilter('ALL')}
                    className="hover:text-foreground ml-0.5 cursor-pointer"
                    aria-label="Clear type filter"
                  >
                    ×
                  </button>
                </Badge>
              )}
              {selectedBranch !== (userBranchId || 'ALL') && (
                <Badge variant="secondary" className="gap-1 text-[11px] font-normal">
                  Branch: {branches.find((b) => b.id === selectedBranch)?.name || selectedBranch}
                  <button
                    type="button"
                    onClick={() => handleBranchFilter('ALL')}
                    className="hover:text-foreground ml-0.5 cursor-pointer"
                    aria-label="Clear branch filter"
                  >
                    ×
                  </button>
                </Badge>
              )}
              {selectedStatus !== 'ALL' && (
                <Badge variant="secondary" className="gap-1 text-[11px] font-normal">
                  Status: {selectedStatus}
                  <button
                    type="button"
                    onClick={() => handleStatusFilter('ALL')}
                    className="hover:text-foreground ml-0.5 cursor-pointer"
                    aria-label="Clear status filter"
                  >
                    ×
                  </button>
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedBranch(userBranchId || 'ALL');
                  setSelectedType('ALL');
                  setSelectedStatus('ALL');
                  fetchOrders(1, { branch: userBranchId || 'ALL', type: 'ALL', status: 'ALL' });
                }}
                className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground ml-auto cursor-pointer"
              >
                Reset All Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card className="border-border/60 shadow-xs">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6">
              <TableSkeleton columns={8} rows={6} />
            </div>
          ) : sortedOrders.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={ShoppingCart}
                title="No orders found"
                description={
                  search || selectedStatus !== 'ALL' || selectedType !== 'ALL' || selectedBranch !== 'ALL'
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
              {/* Desktop Table with Sortable & Filterable Headers */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      {/* Order # (Sortable) */}
                      <TableHead className="w-36">
                        <button
                          type="button"
                          onClick={() => handleSort('orderNumber')}
                          className="flex items-center gap-1.5 hover:text-foreground font-medium text-xs transition-colors cursor-pointer select-none group text-left"
                          aria-label={`Sort by Order number, currently ${sortColumn === 'orderNumber' ? sortDirection : 'none'}`}
                        >
                          <span>Order #</span>
                          <SortIndicator
                            column="orderNumber"
                            currentColumn={sortColumn}
                            direction={sortDirection}
                          />
                        </button>
                      </TableHead>

                      {/* Type & Seating (Sortable + Filter) */}
                      <TableHead>
                        <div className="flex items-center justify-between gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSort('type')}
                            className="flex items-center gap-1.5 hover:text-foreground font-medium text-xs transition-colors cursor-pointer select-none group text-left"
                            aria-label={`Sort by Type, currently ${sortColumn === 'type' ? sortDirection : 'none'}`}
                          >
                            <span>Type & Seating</span>
                            <SortIndicator
                              column="type"
                              currentColumn={sortColumn}
                              direction={sortDirection}
                            />
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <button
                                  type="button"
                                  onClick={(e) => e.stopPropagation()}
                                  className={`p-1 rounded transition-colors cursor-pointer ${
                                    selectedType !== 'ALL'
                                      ? 'text-primary bg-primary/15 hover:bg-primary/20 ring-1 ring-primary/40'
                                      : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted'
                                  }`}
                                  title="Filter by Order Type"
                                  aria-label="Filter by Order Type"
                                >
                                  <Filter className="size-3.5" />
                                </button>
                              }
                            />
                            <DropdownMenuContent align="start" className="w-40 z-50">
                              <DropdownMenuLabel className="text-xs">Order Type</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleTypeFilter('ALL')}
                                className={`text-xs flex items-center justify-between cursor-pointer ${
                                  selectedType === 'ALL' ? 'font-semibold text-primary' : ''
                                }`}
                              >
                                <span>All Types</span>
                                {selectedType === 'ALL' && <Check className="size-3.5 text-primary" />}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleTypeFilter(OrderType.DINE_IN)}
                                className={`text-xs flex items-center justify-between cursor-pointer ${
                                  selectedType === OrderType.DINE_IN ? 'font-semibold text-primary' : ''
                                }`}
                              >
                                <span>Dine-in</span>
                                {selectedType === OrderType.DINE_IN && <Check className="size-3.5 text-primary" />}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleTypeFilter(OrderType.TAKEAWAY)}
                                className={`text-xs flex items-center justify-between cursor-pointer ${
                                  selectedType === OrderType.TAKEAWAY ? 'font-semibold text-primary' : ''
                                }`}
                              >
                                <span>Takeaway</span>
                                {selectedType === OrderType.TAKEAWAY && <Check className="size-3.5 text-primary" />}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleTypeFilter(OrderType.DELIVERY)}
                                className={`text-xs flex items-center justify-between cursor-pointer ${
                                  selectedType === OrderType.DELIVERY ? 'font-semibold text-primary' : ''
                                }`}
                              >
                                <span>Delivery</span>
                                {selectedType === OrderType.DELIVERY && <Check className="size-3.5 text-primary" />}
                              </DropdownMenuItem>
                              {selectedType !== 'ALL' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleTypeFilter('ALL')}
                                    className="text-xs text-muted-foreground justify-center cursor-pointer"
                                  >
                                    Clear filter
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableHead>

                      {/* Customer (Sortable) */}
                      <TableHead>
                        <button
                          type="button"
                          onClick={() => handleSort('customer')}
                          className="flex items-center gap-1.5 hover:text-foreground font-medium text-xs transition-colors cursor-pointer select-none group text-left"
                          aria-label={`Sort by Customer, currently ${sortColumn === 'customer' ? sortDirection : 'none'}`}
                        >
                          <span>Customer</span>
                          <SortIndicator
                            column="customer"
                            currentColumn={sortColumn}
                            direction={sortDirection}
                          />
                        </button>
                      </TableHead>

                      {/* Branch (Sortable + Filter) */}
                      <TableHead>
                        <div className="flex items-center justify-between gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSort('branch')}
                            className="flex items-center gap-1.5 hover:text-foreground font-medium text-xs transition-colors cursor-pointer select-none group text-left"
                            aria-label={`Sort by Branch, currently ${sortColumn === 'branch' ? sortDirection : 'none'}`}
                          >
                            <span>Branch</span>
                            <SortIndicator
                              column="branch"
                              currentColumn={sortColumn}
                              direction={sortDirection}
                            />
                          </button>
                          {branches.length > 1 && !userBranchId && (
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <button
                                    type="button"
                                    onClick={(e) => e.stopPropagation()}
                                    className={`p-1 rounded transition-colors cursor-pointer ${
                                      selectedBranch !== 'ALL'
                                        ? 'text-primary bg-primary/15 hover:bg-primary/20 ring-1 ring-primary/40'
                                        : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted'
                                    }`}
                                    title="Filter by Branch"
                                    aria-label="Filter by Branch"
                                  >
                                    <Filter className="size-3.5" />
                                  </button>
                                }
                              />
                              <DropdownMenuContent align="start" className="w-52 z-50">
                                <DropdownMenuLabel className="text-xs">Filter by Branch</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleBranchFilter('ALL')}
                                  className={`text-xs flex items-center justify-between cursor-pointer ${
                                    selectedBranch === 'ALL' ? 'font-semibold text-primary' : ''
                                  }`}
                                >
                                  <span>All Branches</span>
                                  {selectedBranch === 'ALL' && <Check className="size-3.5 text-primary" />}
                                </DropdownMenuItem>
                                {branches.map((b) => (
                                  <DropdownMenuItem
                                    key={b.id}
                                    onClick={() => handleBranchFilter(b.id)}
                                    className={`text-xs flex items-center justify-between cursor-pointer ${
                                      selectedBranch === b.id ? 'font-semibold text-primary' : ''
                                    }`}
                                  >
                                    <span className="truncate">{b.name} ({b.code})</span>
                                    {selectedBranch === b.id && <Check className="size-3.5 text-primary shrink-0" />}
                                  </DropdownMenuItem>
                                ))}
                                {selectedBranch !== 'ALL' && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleBranchFilter('ALL')}
                                      className="text-xs text-muted-foreground justify-center cursor-pointer"
                                    >
                                      Clear filter
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </TableHead>

                      {/* Items (Sortable) */}
                      <TableHead className="text-center">
                        <button
                          type="button"
                          onClick={() => handleSort('items')}
                          className="inline-flex items-center gap-1.5 hover:text-foreground font-medium text-xs transition-colors cursor-pointer select-none group"
                          aria-label={`Sort by Items count, currently ${sortColumn === 'items' ? sortDirection : 'none'}`}
                        >
                          <span>Items</span>
                          <SortIndicator
                            column="items"
                            currentColumn={sortColumn}
                            direction={sortDirection}
                          />
                        </button>
                      </TableHead>

                      {/* Total (Sortable) */}
                      <TableHead className="text-right">
                        <button
                          type="button"
                          onClick={() => handleSort('total')}
                          className="inline-flex items-center gap-1.5 hover:text-foreground font-medium text-xs transition-colors cursor-pointer select-none group ml-auto"
                          aria-label={`Sort by Total amount, currently ${sortColumn === 'total' ? sortDirection : 'none'}`}
                        >
                          <span>Total</span>
                          <SortIndicator
                            column="total"
                            currentColumn={sortColumn}
                            direction={sortDirection}
                          />
                        </button>
                      </TableHead>

                      {/* Status (Sortable + Filter) */}
                      <TableHead>
                        <div className="flex items-center justify-between gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSort('status')}
                            className="flex items-center gap-1.5 hover:text-foreground font-medium text-xs transition-colors cursor-pointer select-none group text-left"
                            aria-label={`Sort by Status, currently ${sortColumn === 'status' ? sortDirection : 'none'}`}
                          >
                            <span>Status</span>
                            <SortIndicator
                              column="status"
                              currentColumn={sortColumn}
                              direction={sortDirection}
                            />
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <button
                                  type="button"
                                  onClick={(e) => e.stopPropagation()}
                                  className={`p-1 rounded transition-colors cursor-pointer ${
                                    selectedStatus !== 'ALL'
                                      ? 'text-primary bg-primary/15 hover:bg-primary/20 ring-1 ring-primary/40'
                                      : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted'
                                  }`}
                                  title="Filter by Status"
                                  aria-label="Filter by Status"
                                >
                                  <Filter className="size-3.5" />
                                </button>
                              }
                            />
                            <DropdownMenuContent align="end" className="w-44 z-50">
                              <DropdownMenuLabel className="text-xs">Order Status</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {[
                                { label: 'All Statuses', value: 'ALL' },
                                { label: 'Pending', value: OrderStatus.PENDING },
                                { label: 'Confirmed', value: OrderStatus.CONFIRMED },
                                { label: 'Preparing', value: OrderStatus.PREPARING },
                                { label: 'Ready', value: OrderStatus.READY },
                                { label: 'Completed', value: OrderStatus.COMPLETED },
                                { label: 'Cancelled', value: OrderStatus.CANCELLED },
                              ].map((item) => (
                                <DropdownMenuItem
                                  key={item.value}
                                  onClick={() => handleStatusFilter(item.value)}
                                  className={`text-xs flex items-center justify-between cursor-pointer ${
                                    selectedStatus === item.value ? 'font-semibold text-primary' : ''
                                  }`}
                                >
                                  <span>{item.label}</span>
                                  {selectedStatus === item.value && <Check className="size-3.5 text-primary" />}
                                </DropdownMenuItem>
                              ))}
                              {selectedStatus !== 'ALL' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleStatusFilter('ALL')}
                                    className="text-xs text-muted-foreground justify-center cursor-pointer"
                                  >
                                    Clear filter
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableHead>

                      {/* Directly Visible Icon Actions Column */}
                      <TableHead className="text-right w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedOrders.map((ord) => (
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
                          ₹{ord.totalAmount.toFixed(2)}
                        </TableCell>

                        <TableCell>{getStatusBadge(ord.status)}</TableCell>

                        {/* Directly Visible Icon Buttons (Edit & Delete/Cancel) */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {canUpdate && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Edit order"
                                title="Edit order"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditOrder(ord);
                                }}
                                className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                            )}
                            {canCancel && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Delete order"
                                title="Delete order"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteOrder(ord);
                                }}
                                className="h-8 w-8 text-destructive/80 hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card List */}
              <div className="md:hidden divide-y divide-border/60">
                {sortedOrders.map((ord) => (
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
                        ₹{ord.totalAmount.toFixed(2)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                      <div className="text-muted-foreground truncate mr-2">
                        {ord.customerName ? ord.customerName : 'Guest'} • {ord.itemCount} items
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Link
                          href={`/orders/${ord.id}`}
                          className={buttonVariants({
                            variant: 'ghost',
                            size: 'sm',
                            className: 'h-8 px-2 text-xs',
                          })}
                        >
                          <Eye className="size-3.5 mr-1" />
                          Details
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Edit order"
                          title="Edit order"
                          onClick={() => handleEditOrder(ord)}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Delete order"
                          title="Delete order"
                          onClick={() => handleDeleteOrder(ord)}
                          className="h-8 w-8 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
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
                      className="h-9 sm:h-7 px-3 sm:px-2"
                    >
                      <ChevronLeft className="size-3.5" />
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchOrders(pagination.page + 1)}
                      disabled={pagination.page >= pagination.totalPages || isLoading}
                      className="h-9 sm:h-7 px-3 sm:px-2"
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

      {/* Edit Order Dialog */}
      {editDialogOrder && (
        <OrderEditDialog
          open={!!editDialogOrder}
          onOpenChange={(open) => !open && setEditDialogOrder(null)}
          orderId={editDialogOrder.id}
          orderNumber={editDialogOrder.orderNumber}
          onSuccess={() => fetchOrders(pagination.page)}
        />
      )}

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
