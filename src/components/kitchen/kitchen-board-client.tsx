'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import Link from 'next/link';
import {
  ChefHat,
  Clock,
  Utensils,
  ShoppingBag,
  Truck,
  RefreshCw,
  Maximize2,
  Minimize2,
  CheckCircle2,
  Pause,
  LogOut,
  Building2,
  User,
  Sparkles,
  ArrowLeft,
  Loader2,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { OrderType } from '@prisma/client';

import { useAuth } from '@/providers/auth-provider';
import { hasPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { logoutAction } from '@/lib/auth/actions';
import {
  getKitchenOrders,
  startOrderPreparation,
  markOrderReady,
  completeKitchenOrder,
} from '@/lib/kitchen/actions';
import type {
  KitchenBoardData,
  KitchenOrderCardData,
  InsufficientStockDetail,
} from '@/lib/kitchen/types';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardFooter,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface BranchOption {
  id: string;
  name: string;
  code: string;
}

interface KitchenBoardClientProps {
  initialData: KitchenBoardData;
  branches: BranchOption[];
  userBranchId?: string | null;
}

export function KitchenBoardClient({
  initialData,
  branches,
  userBranchId,
}: KitchenBoardClientProps) {
  const user = useAuth();
  const [isPending, startTransition] = useTransition();

  // Active board state
  const [boardData, setBoardData] = useState<KitchenBoardData>(initialData);
  const [selectedBranch, setSelectedBranch] = useState<string>(
    userBranchId || (branches.length > 0 ? branches[0].id : 'ALL')
  );
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>('ALL');
  const [activeColumnView, setActiveColumnView] = useState<'ALL' | 'NEW' | 'PREPARING' | 'READY'>('ALL');

  // Real-time auto-refresh state (15s interval)
  const [isAutoRefresh, setIsAutoRefresh] = useState<boolean>(true);
  const [countdown, setCountdown] = useState<number>(15);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(() => Date.now());

  // Action processing state per order
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);

  // Insufficient stock modal state
  const [shortageDialogData, setShortageDialogData] = useState<{
    orderNumber: string;
    shortages: InsufficientStockDetail[];
  } | null>(null);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Permissions
  const canStart = hasPermission(user, PERMISSIONS.KITCHEN_START);
  const canReady = hasPermission(user, PERMISSIONS.KITCHEN_READY);
  const canComplete =
    hasPermission(user, PERMISSIONS.KITCHEN_COMPLETE) ||
    hasPermission(user, PERMISSIONS.ORDER_STATUS);

  // Ticker for updating live elapsed times
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Fetch kitchen orders
  const fetchBoard = useCallback(
    async (branch: string = selectedBranch, type: string = orderTypeFilter) => {
      setIsRefreshing(true);
      try {
        const res = await getKitchenOrders(branch, type);
        if (res.success && res.data) {
          setBoardData(res.data);
        } else {
          toast.error(res.error || 'Failed to update kitchen board');
        }
      } catch (err) {
        console.error('KDS refresh error:', err);
      } finally {
        setIsRefreshing(false);
        setCountdown(15);
      }
    },
    [selectedBranch, orderTypeFilter]
  );

  // Auto-refresh countdown loop
  useEffect(() => {
    if (!isAutoRefresh) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchBoard();
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isAutoRefresh, fetchBoard]);

  // Handle branch switch
  const handleBranchChange = (newBranch: string) => {
    setSelectedBranch(newBranch);
    fetchBoard(newBranch, orderTypeFilter);
  };

  // Handle order type filter
  const handleTypeChange = (newType: string) => {
    setOrderTypeFilter(newType);
    fetchBoard(selectedBranch, newType);
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  // Handle "Start Preparing" action (triggers atomic inventory deduction)
  const handleStartPreparing = (order: KitchenOrderCardData) => {
    setProcessingOrderId(order.id);
    startTransition(async () => {
      try {
        const res = await startOrderPreparation(order.id);
        if (res.success && res.data) {
          toast.success(`Preparation started for ${order.orderNumber}!`, {
            description: `Deducted ingredients for ${res.data.ingredientsDeducted} recipe item(s).`,
          });
          if (res.data.warnings && res.data.warnings.length > 0) {
            toast.warning(res.data.warnings[0]);
          }
          await fetchBoard();
        } else {
          // If insufficient inventory, open detail dialog
          if (res.data?.shortages && res.data.shortages.length > 0) {
            setShortageDialogData({
              orderNumber: order.orderNumber,
              shortages: res.data.shortages,
            });
          } else {
            toast.error(res.error || 'Failed to start preparation');
          }
        }
      } catch (err) {
        console.error(err);
        toast.error('Unexpected error while starting preparation');
      } finally {
        setProcessingOrderId(null);
      }
    });
  };

  // Handle "Mark Ready" action
  const handleMarkReady = (order: KitchenOrderCardData) => {
    setProcessingOrderId(order.id);
    startTransition(async () => {
      try {
        const res = await markOrderReady(order.id);
        if (res.success) {
          toast.success(`Order ${order.orderNumber} is READY!`);
          await fetchBoard();
        } else {
          toast.error(res.error || 'Failed to mark order ready');
        }
      } catch (err) {
        console.error(err);
        toast.error('Unexpected error while marking ready');
      } finally {
        setProcessingOrderId(null);
      }
    });
  };

  // Handle "Complete Order" action
  const handleCompleteOrder = (order: KitchenOrderCardData) => {
    setProcessingOrderId(order.id);
    startTransition(async () => {
      try {
        const res = await completeKitchenOrder(order.id);
        if (res.success) {
          toast.success(`Order ${order.orderNumber} completed!`);
          await fetchBoard();
        } else {
          toast.error(res.error || 'Failed to complete order');
        }
      } catch (err) {
        console.error(err);
        toast.error('Unexpected error while completing order');
      } finally {
        setProcessingOrderId(null);
      }
    });
  };

  // Helper for live elapsed duration
  const getElapsedString = (createdAt: string) => {
    const diffMs = currentTime - new Date(createdAt).getTime();
    const totalMinutes = Math.max(0, Math.floor(diffMs / (1000 * 60)));
    const seconds = Math.max(0, Math.floor((diffMs % (1000 * 60)) / 1000));

    if (totalMinutes < 60) {
      return `${totalMinutes}m ${seconds}s`;
    }
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}h ${mins}m`;
  };

  // Subtle urgency color helper (no aggressive flashing)
  const getElapsedUrgencyStyle = (elapsedMinutes: number, targetMinutes: number = 15) => {
    if (elapsedMinutes >= targetMinutes * 1.5) {
      // Overdue/High wait
      return 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30';
    }
    if (elapsedMinutes >= targetMinutes) {
      // Approaching target
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30';
    }
    // Normal/Fresh
    return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
  };

  const getOrderTypeBadge = (order: KitchenOrderCardData) => {
    switch (order.orderType) {
      case OrderType.DINE_IN:
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 font-bold px-2.5 py-0.5 text-xs flex items-center gap-1">
            <Utensils className="h-3.5 w-3.5" />
            DINE-IN {order.tableNumber ? `• Table ${order.tableNumber}` : ''}
          </Badge>
        );
      case OrderType.TAKEAWAY:
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 font-bold px-2.5 py-0.5 text-xs flex items-center gap-1">
            <ShoppingBag className="h-3.5 w-3.5" />
            TAKEAWAY
          </Badge>
        );
      case OrderType.DELIVERY:
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-bold px-2.5 py-0.5 text-xs flex items-center gap-1">
            <Truck className="h-3.5 w-3.5" />
            DELIVERY
          </Badge>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col select-none">
      {/* ── Operational KDS Header Bar ────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-card border-b shadow-xs px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Branding, Branch Indicator & Link */}
        <div className="flex items-center gap-3">
          <Link
            href="/orders"
            className="flex items-center gap-2 text-foreground hover:opacity-80 transition-opacity"
            title="Exit to Orders Dashboard"
          >
            <div className="p-1.5 rounded-lg bg-primary text-primary-foreground shadow-xs">
              <ChefHat className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-black tracking-tight uppercase">
                  Oven Xpress
                </span>
                <span className="text-[11px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-400 uppercase">
                  KDS Live
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground block -mt-0.5">
                Kitchen Display System
              </span>
            </div>
          </Link>

          {/* Branch Switcher (or locked badge) */}
          <div className="ml-2 pl-3 border-l flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            {userBranchId ? (
              <span className="text-xs font-bold text-foreground">
                {branches.find((b) => b.id === userBranchId)?.name || 'Assigned Branch'}
              </span>
            ) : (
              <Select value={selectedBranch} onValueChange={(val) => { if (val) handleBranchChange(val); }}>
                <SelectTrigger className="h-7 text-xs w-44 font-semibold bg-muted/50 border-none">
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
          </div>
        </div>

        {/* Center: Operational KPI Counters */}
        <div className="flex items-center gap-2 bg-muted/40 p-1 rounded-xl border">
          <button
            type="button"
            onClick={() => setActiveColumnView('ALL')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              activeColumnView === 'ALL'
                ? 'bg-background shadow-xs text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>All Active</span>
            <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-bold">
              {boardData.stats.totalActiveCount}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setActiveColumnView('NEW')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              activeColumnView === 'NEW'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>New</span>
            <Badge className="h-5 px-1.5 text-[11px] font-bold bg-amber-600 text-white">
              {boardData.stats.newOrdersCount}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setActiveColumnView('PREPARING')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              activeColumnView === 'PREPARING'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>Prep</span>
            <Badge className="h-5 px-1.5 text-[11px] font-bold bg-purple-700 text-white">
              {boardData.stats.preparingOrdersCount}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setActiveColumnView('READY')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              activeColumnView === 'READY'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>Ready</span>
            <Badge className="h-5 px-1.5 text-[11px] font-bold bg-emerald-700 text-white">
              {boardData.stats.readyOrdersCount}
            </Badge>
          </button>
        </div>

        {/* Right: Controls (Filter, Auto-refresh, Fullscreen, User, Exit) */}
        <div className="flex items-center gap-2">
          {/* Order Type Filter */}
          <Select value={orderTypeFilter} onValueChange={(val) => { if (val) handleTypeChange(val); }}>
            <SelectTrigger className="h-8 text-xs w-32 font-medium">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Order Types</SelectItem>
              <SelectItem value={OrderType.DINE_IN}>Dine-In</SelectItem>
              <SelectItem value={OrderType.TAKEAWAY}>Takeaway</SelectItem>
              <SelectItem value={OrderType.DELIVERY}>Delivery</SelectItem>
            </SelectContent>
          </Select>

          {/* Auto-Refresh Toggle Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
            className="h-8 px-2.5 text-xs gap-1.5"
            title={isAutoRefresh ? 'Pause Auto-Refresh' : 'Enable Auto-Refresh'}
          >
            {isAutoRefresh ? (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-semibold">{countdown}s</span>
              </>
            ) : (
              <>
                <Pause className="h-3.5 w-3.5 text-amber-500" />
                <span>Paused</span>
              </>
            )}
          </Button>

          {/* Instant Manual Refresh */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchBoard()}
            disabled={isRefreshing}
            className="h-8 w-8 p-0"
            title="Refresh Now"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
          </Button>

          {/* Fullscreen Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            className="h-8 w-8 p-0 hidden sm:flex"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>

          {/* Current User */}
          <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/60 text-xs text-muted-foreground">
            <User className="h-3.5 w-3.5" />
            <span className="font-medium text-foreground max-w-28 truncate">
              {user.name}
            </span>
          </div>

          {/* Exit / Return to dashboard */}
          <Link
            href="/orders"
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted"
            title="Return to Main App"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Exit</span>
          </Link>

          {/* Kitchen Logout */}
          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-1 text-xs font-semibold text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
              title="Logout"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </form>
        </div>
      </header>

      {/* ── Main KDS Board Grid ──────────────────────────────────────────────── */}
      <main className="flex-1 p-4 overflow-x-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-w-3xl h-full items-start">
          {/* COLUMN 1: NEW / CONFIRMED ORDERS */}
          {(activeColumnView === 'ALL' || activeColumnView === 'NEW') && (
            <div className="space-y-3 flex flex-col h-full bg-muted/20 p-3 rounded-xl border">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-amber-500" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                    New Orders
                  </h2>
                </div>
                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold text-xs">
                  {boardData.newOrders.length}
                </Badge>
              </div>

              <div className="space-y-3 flex-1 overflow-y-auto">
                {boardData.newOrders.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-xs">
                    <ChefHat className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                    No new orders waiting.
                  </div>
                ) : (
                  boardData.newOrders.map((order) => {
                    const isOrderProcessing = processingOrderId === order.id;

                    return (
                      <Card
                        key={order.id}
                        className="border-l-4 border-l-amber-500 shadow-sm bg-card hover:shadow-md transition-shadow"
                      >
                        <CardHeader className="p-3 pb-2 space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-base font-black tracking-tight text-foreground">
                              {order.orderNumber}
                            </span>
                            <span
                              className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${getElapsedUrgencyStyle(
                                order.elapsedMinutes,
                                order.targetPrepMinutes
                              )}`}
                            >
                              <Clock className="h-3 w-3 inline mr-1 -mt-0.5" />
                              {getElapsedString(order.createdAt)}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            {getOrderTypeBadge(order)}
                            {order.customerName && (
                              <span className="text-xs text-muted-foreground font-medium truncate max-w-36">
                                • {order.customerName}
                              </span>
                            )}
                          </div>
                        </CardHeader>

                        <CardContent className="p-3 pt-1 space-y-2.5">
                          {/* Ordered Items List */}
                          <div className="space-y-1.5 divide-y divide-border/40">
                            {order.items.map((item) => (
                              <div key={item.id} className="pt-1.5 first:pt-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-1.5">
                                    <span className="text-sm font-black text-amber-600 dark:text-amber-400 shrink-0">
                                      {item.quantity}×
                                    </span>
                                    <span className="text-sm font-bold text-foreground">
                                      {item.itemName}
                                    </span>
                                  </div>

                                  {!item.hasRecipe && (
                                    <span
                                      className="text-[9px] px-1 py-0.2 rounded bg-muted text-muted-foreground uppercase font-semibold shrink-0"
                                      title="No Recipe/BOM configured for this item"
                                    >
                                      No BOM
                                    </span>
                                  )}
                                </div>

                                {item.notes && (
                                  <div className="text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-500/15 border border-amber-500/30 rounded px-1.5 py-0.5 mt-1 inline-block">
                                    Note: {item.notes}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Order Operational Notes */}
                          {order.notes && (
                            <div className="text-xs text-blue-800 dark:text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded p-1.5 font-medium">
                              {order.notes}
                            </div>
                          )}

                          {order.deliveryNotes && (
                            <div className="text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded p-1.5 font-medium">
                              Delivery: {order.deliveryNotes}
                            </div>
                          )}
                        </CardContent>

                        <CardFooter className="p-3 pt-0">
                          {canStart ? (
                            <Button
                              type="button"
                              onClick={() => handleStartPreparing(order)}
                              disabled={isPending || isOrderProcessing}
                              className="w-full h-9 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs gap-1.5 shadow-xs"
                            >
                              {isOrderProcessing ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Checking Stock & Starting...
                                </>
                              ) : (
                                <>
                                  <ChefHat className="h-4 w-4" />
                                  Start Preparing
                                </>
                              )}
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground italic w-full text-center">
                              Awaiting Kitchen Start
                            </span>
                          )}
                        </CardFooter>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* COLUMN 2: PREPARING ORDERS */}
          {(activeColumnView === 'ALL' || activeColumnView === 'PREPARING') && (
            <div className="space-y-3 flex flex-col h-full bg-muted/20 p-3 rounded-xl border">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-purple-500" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                    In Preparation
                  </h2>
                </div>
                <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-400 font-bold text-xs">
                  {boardData.preparingOrders.length}
                </Badge>
              </div>

              <div className="space-y-3 flex-1 overflow-y-auto">
                {boardData.preparingOrders.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-xs">
                    <ChefHat className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                    No orders currently in preparation.
                  </div>
                ) : (
                  boardData.preparingOrders.map((order) => {
                    const isOrderProcessing = processingOrderId === order.id;
                    const prepElapsed = order.preparingAt
                      ? getElapsedString(order.preparingAt)
                      : getElapsedString(order.createdAt);

                    return (
                      <Card
                        key={order.id}
                        className="border-l-4 border-l-purple-500 shadow-sm bg-card hover:shadow-md transition-shadow"
                      >
                        <CardHeader className="p-3 pb-2 space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-base font-black tracking-tight text-foreground">
                              {order.orderNumber}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/30">
                                Prep: {prepElapsed}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            {getOrderTypeBadge(order)}
                            <span className="text-xs text-muted-foreground font-mono">
                              Total: {getElapsedString(order.createdAt)}
                            </span>
                          </div>
                        </CardHeader>

                        <CardContent className="p-3 pt-1 space-y-2.5">
                          {/* Ordered Items List */}
                          <div className="space-y-1.5 divide-y divide-border/40">
                            {order.items.map((item) => (
                              <div key={item.id} className="pt-1.5 first:pt-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-1.5">
                                    <span className="text-sm font-black text-purple-600 dark:text-purple-400 shrink-0">
                                      {item.quantity}×
                                    </span>
                                    <span className="text-sm font-bold text-foreground">
                                      {item.itemName}
                                    </span>
                                  </div>
                                </div>

                                {item.notes && (
                                  <div className="text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-500/15 border border-amber-500/30 rounded px-1.5 py-0.5 mt-1 inline-block">
                                    Note: {item.notes}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Operational Notes */}
                          {order.notes && (
                            <div className="text-xs text-blue-800 dark:text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded p-1.5 font-medium">
                              {order.notes}
                            </div>
                          )}
                        </CardContent>

                        <CardFooter className="p-3 pt-0">
                          {canReady ? (
                            <Button
                              type="button"
                              onClick={() => handleMarkReady(order)}
                              disabled={isPending || isOrderProcessing}
                              className="w-full h-9 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs gap-1.5 shadow-xs"
                            >
                              {isOrderProcessing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Sparkles className="h-4 w-4" />
                              )}
                              Mark Ready
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground italic w-full text-center">
                              In Preparation
                            </span>
                          )}
                        </CardFooter>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* COLUMN 3: READY ORDERS */}
          {(activeColumnView === 'ALL' || activeColumnView === 'READY') && (
            <div className="space-y-3 flex flex-col h-full bg-muted/20 p-3 rounded-xl border">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-emerald-500" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                    Ready for Service
                  </h2>
                </div>
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                  {boardData.readyOrders.length}
                </Badge>
              </div>

              <div className="space-y-3 flex-1 overflow-y-auto">
                {boardData.readyOrders.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-xs">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                    No orders waiting to be served or picked up.
                  </div>
                ) : (
                  boardData.readyOrders.map((order) => {
                    const isOrderProcessing = processingOrderId === order.id;

                    return (
                      <Card
                        key={order.id}
                        className="border-l-4 border-l-emerald-500 shadow-sm bg-card hover:shadow-md transition-shadow"
                      >
                        <CardHeader className="p-3 pb-2 space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-base font-black tracking-tight text-foreground">
                              {order.orderNumber}
                            </span>
                            <Badge className="bg-emerald-500 text-white font-bold text-[10px] px-2">
                              READY
                            </Badge>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            {getOrderTypeBadge(order)}
                            <span className="text-xs text-muted-foreground font-mono">
                              Total: {getElapsedString(order.createdAt)}
                            </span>
                          </div>
                        </CardHeader>

                        <CardContent className="p-3 pt-1 space-y-2">
                          {/* Ordered Items summary */}
                          <div className="space-y-1 divide-y divide-border/40">
                            {order.items.map((item) => (
                              <div key={item.id} className="pt-1 first:pt-0 flex items-center justify-between">
                                <span className="text-sm font-medium text-foreground">
                                  <strong className="text-emerald-600 dark:text-emerald-400 mr-1">
                                    {item.quantity}×
                                  </strong>
                                  {item.itemName}
                                </span>
                              </div>
                            ))}
                          </div>
                        </CardContent>

                        <CardFooter className="p-3 pt-0">
                          {canComplete ? (
                            <Button
                              type="button"
                              onClick={() => handleCompleteOrder(order)}
                              disabled={isPending || isOrderProcessing}
                              variant="outline"
                              className="w-full h-9 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 font-bold text-xs gap-1.5"
                            >
                              {isOrderProcessing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                              Complete Order
                            </Button>
                          ) : (
                            <div className="w-full text-center py-1 text-xs text-muted-foreground font-semibold flex items-center justify-center gap-1 bg-muted/40 rounded">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              Awaiting Service / Dispatch
                            </div>
                          )}
                        </CardFooter>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── Insufficient Stock Warning Dialog ─────────────────────────────────── */}
      <Dialog
        open={!!shortageDialogData}
        onOpenChange={(open) => {
          if (!open) setShortageDialogData(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive mb-1">
              <ShieldAlert className="h-5 w-5" />
              <DialogTitle className="text-base font-bold text-foreground">
                Insufficient Inventory
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Order {shortageDialogData?.orderNumber} cannot be started because one or more required recipe ingredients have insufficient stock in this branch.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted text-muted-foreground border-b font-semibold">
                  <tr>
                    <th className="p-2">Ingredient</th>
                    <th className="p-2 text-right">Required</th>
                    <th className="p-2 text-right">Available</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {shortageDialogData?.shortages.map((s) => (
                    <tr key={s.ingredientId} className="bg-destructive/5">
                      <td className="p-2 font-semibold text-foreground">
                        {s.ingredientName}
                      </td>
                      <td className="p-2 text-right font-mono text-foreground font-bold">
                        {s.requiredQuantity} {s.unit}
                      </td>
                      <td className="p-2 text-right font-mono text-destructive font-black">
                        {s.availableQuantity} {s.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-2.5 rounded-lg bg-muted/50 border text-xs text-muted-foreground flex items-start gap-2">
              <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>
                Please replenish stock via a Purchase Order or Stock Adjustment before starting preparation. The order remains <strong>CONFIRMED</strong> with zero stock deducted.
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShortageDialogData(null)}
              className="w-full text-xs font-semibold"
            >
              Acknowledge & Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
