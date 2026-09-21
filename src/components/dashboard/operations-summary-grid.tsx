'use client';

import React from 'react';
import Link from 'next/link';
import {
  ShoppingCart,
  CreditCard,
  UtensilsCrossed,
  Package,
  Users,
  CheckSquare,
  ArrowRight,
  Star,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type {
  OrderOverviewStats,
  PaymentOverviewStats,
  TopProductItem,
  InventoryHealthStats,
  AttendanceOverviewStats,
  PendingApprovalsStats,
  CustomerFeedbackStats,
} from '@/lib/reports/dashboard-types';
import { formatCurrency } from '@/lib/reports/constants';

interface OperationsSummaryGridProps {
  orderOverview: OrderOverviewStats;
  paymentOverview: PaymentOverviewStats;
  topProducts: TopProductItem[];
  inventoryHealth: InventoryHealthStats;
  attendanceOverview: AttendanceOverviewStats;
  pendingApprovals: PendingApprovalsStats;
  customerFeedback: CustomerFeedbackStats;
  canViewFinancials: boolean;
  isPending?: boolean;
}

export function OperationsSummaryGrid({
  orderOverview,
  paymentOverview,
  topProducts,
  inventoryHealth,
  attendanceOverview,
  pendingApprovals,
  customerFeedback,
  canViewFinancials,
  isPending,
}: OperationsSummaryGridProps) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 ${isPending ? 'opacity-50' : ''}`}>
      {/* ─── 1. Order Status & Channels ────────────────────────────────────── */}
      <Card className="border border-border/60 shadow-sm flex flex-col justify-between">
        <div>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-blue-500" />
              <CardTitle className="text-sm font-semibold">Orders Breakdown</CardTitle>
            </div>
            <Link
              href="/orders"
              className="text-xs text-primary hover:underline flex items-center gap-0.5"
            >
              <span>View Orders</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Status pills */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Order Pipeline Status
              </span>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="p-2 bg-muted/40 rounded-xl flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Pending</span>
                  <span className="font-bold">{orderOverview.pending}</span>
                </div>
                <div className="p-2 bg-muted/40 rounded-xl flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Preparing</span>
                  <span className="font-bold">{orderOverview.preparing}</span>
                </div>
                <div className="p-2 bg-muted/40 rounded-xl flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Ready</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    {orderOverview.ready}
                  </span>
                </div>
                <div className="p-2 bg-muted/40 rounded-xl flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Completed</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {orderOverview.completed}
                  </span>
                </div>
                <div className="p-2 bg-muted/40 rounded-xl flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Cancelled</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    {orderOverview.cancelled}
                  </span>
                </div>
                <div className="p-2 bg-muted/40 rounded-xl flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Refunded</span>
                  <span className="font-bold">{orderOverview.refunded}</span>
                </div>
              </div>
            </div>

            {/* Channels breakdown */}
            <div className="pt-2 border-t border-border/40">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Dining Channels
              </span>
              <div className="space-y-2 mt-2">
                {orderOverview.orderTypes.map((ot) => {
                  const pct =
                    orderOverview.totalOrders > 0
                      ? Math.round((ot.count / orderOverview.totalOrders) * 100)
                      : 0;
                  return (
                    <div key={ot.type} className="space-y-1 text-xs">
                      <div className="flex justify-between font-medium">
                        <span>{ot.type.replace('_', ' ')}</span>
                        <span>
                          {ot.count} orders ({pct}%)
                          {canViewFinancials && ot.amount > 0 && ` • ${formatCurrency(ot.amount)}`}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </div>
      </Card>

      {/* ─── 2. Payment Overview ────────────────────────────────────────────── */}
      <Card className="border border-border/60 shadow-sm flex flex-col justify-between">
        <div>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-500" />
              <CardTitle className="text-sm font-semibold">Payment Methods</CardTitle>
            </div>
            <Link
              href="/payments"
              className="text-xs text-primary hover:underline flex items-center gap-0.5"
            >
              <span>View Payments</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="space-y-2">
              {paymentOverview.methods.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No successful payments recorded in this period.
                </div>
              ) : (
                paymentOverview.methods.map((pm) => (
                  <div
                    key={pm.method}
                    className="p-2.5 bg-muted/40 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {pm.method}
                      </Badge>
                      <span className="text-muted-foreground">{pm.count} txns</span>
                    </div>
                    {canViewFinancials && (
                      <span className="font-semibold text-foreground">
                        {formatCurrency(pm.amount)}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-border/40 grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-muted/30 rounded-lg">
                <div className="text-[11px] text-muted-foreground">Settled Total</div>
                <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {canViewFinancials
                    ? formatCurrency(paymentOverview.totalSuccessfulAmount)
                    : `${paymentOverview.totalSuccessfulCount} txns`}
                </div>
              </div>
              <div className="p-2 bg-muted/30 rounded-lg">
                <div className="text-[11px] text-muted-foreground">Failed Payments</div>
                <div className="font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                  {paymentOverview.failedCount} txns
                </div>
              </div>
            </div>
          </CardContent>
        </div>
      </Card>

      {/* ─── 3. Top Selling Products ───────────────────────────────────────── */}
      <Card className="border border-border/60 shadow-sm flex flex-col justify-between">
        <div>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4 text-amber-500" />
              <CardTitle className="text-sm font-semibold">Top Selling Products</CardTitle>
            </div>
            <Link
              href="/menu"
              className="text-xs text-primary hover:underline flex items-center gap-0.5"
            >
              <span>View Menu</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>

          <CardContent>
            {topProducts.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No product sales recorded in this period.
              </div>
            ) : (
              <div className="space-y-2">
                {topProducts.slice(0, 5).map((item, idx) => (
                  <div
                    key={item.menuItemId}
                    className="flex items-center justify-between p-2 rounded-xl bg-muted/40 text-xs"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="w-4 text-center font-mono text-[11px] text-muted-foreground font-semibold">
                        #{idx + 1}
                      </span>
                      <div className="truncate">
                        <div className="font-medium text-foreground truncate">{item.menuItemName}</div>
                        <div className="text-[10px] text-muted-foreground">{item.categoryName}</div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-semibold">{item.quantitySold} sold</div>
                      {canViewFinancials && (
                        <div className="text-[11px] text-primary">{formatCurrency(item.netSales)}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </div>
      </Card>

      {/* ─── 4. Inventory Health ───────────────────────────────────────────── */}
      <Card className="border border-border/60 shadow-sm flex flex-col justify-between">
        <div>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-indigo-500" />
              <CardTitle className="text-sm font-semibold">Inventory Health</CardTitle>
            </div>
            <Link
              href="/inventory"
              className="text-xs text-primary hover:underline flex items-center gap-0.5"
            >
              <span>View Inventory</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                <div className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                  Out of Stock
                </div>
                <div className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                  {inventoryHealth.outOfStockCount}
                </div>
              </div>

              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                  Low Stock Items
                </div>
                <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                  {inventoryHealth.lowStockCount}
                </div>
              </div>

              <div className="p-2.5 bg-muted/40 rounded-xl">
                <div className="text-[11px] text-muted-foreground font-medium">Stock Variances</div>
                <div className="text-lg font-bold text-foreground mt-1">
                  {inventoryHealth.stockVarianceCount}
                </div>
              </div>

              <div className="p-2.5 bg-muted/40 rounded-xl">
                <div className="text-[11px] text-muted-foreground font-medium">Wastage / Damage</div>
                <div className="text-lg font-bold text-foreground mt-1">
                  {inventoryHealth.damageWastageQty} units
                </div>
              </div>
            </div>

            {inventoryHealth.recentIssues.length > 0 && (
              <div className="pt-2 border-t border-border/40 space-y-1.5">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Needs Attention
                </div>
                {inventoryHealth.recentIssues.slice(0, 2).map((iss) => (
                  <div
                    key={iss.id}
                    className="p-1.5 bg-muted/30 rounded-lg text-xs flex items-center justify-between"
                  >
                    <span className="font-medium truncate">{iss.itemName}</span>
                    <Badge variant="outline" className="text-[10px] text-rose-500 shrink-0">
                      {iss.type.replace('_', ' ')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </div>
      </Card>

      {/* ─── 5. Attendance Facts ───────────────────────────────────────────── */}
      <Card className="border border-border/60 shadow-sm flex flex-col justify-between">
        <div>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-500" />
              <CardTitle className="text-sm font-semibold">Attendance Facts</CardTitle>
            </div>
            <Link
              href="/attendance"
              className="text-xs text-primary hover:underline flex items-center gap-0.5"
            >
              <span>View Attendance</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  Present
                </div>
                <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {attendanceOverview.present}
                </div>
              </div>

              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                <div className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                  Absent
                </div>
                <div className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                  {attendanceOverview.absent}
                </div>
              </div>

              <div className="p-2 bg-muted/40 rounded-xl flex items-center justify-between">
                <span className="text-muted-foreground text-[11px]">Half Day</span>
                <span className="font-semibold text-xs">{attendanceOverview.halfDay}</span>
              </div>

              <div className="p-2 bg-muted/40 rounded-xl flex items-center justify-between">
                <span className="text-muted-foreground text-[11px]">On Leave</span>
                <span className="font-semibold text-xs">{attendanceOverview.leave}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-border/40 grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-amber-500/10 rounded-lg flex items-center justify-between">
                <span className="text-amber-600 dark:text-amber-400 text-[11px]">Late Arrivals</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">
                  {attendanceOverview.lateArrivals}
                </span>
              </div>
              <div className="p-2 bg-muted/40 rounded-lg flex items-center justify-between">
                <span className="text-muted-foreground text-[11px]">Early Departures</span>
                <span className="font-bold text-foreground">
                  {attendanceOverview.earlyDepartures}
                </span>
              </div>
            </div>
          </CardContent>
        </div>
      </Card>

      {/* ─── 6. Pending Approvals & Feedback ───────────────────────────────── */}
      <Card className="border border-border/60 shadow-sm flex flex-col justify-between">
        <div>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-violet-500" />
              <CardTitle className="text-sm font-semibold">Pending Approvals</CardTitle>
            </div>
            <Badge
              variant={pendingApprovals.totalPendingCount > 0 ? 'default' : 'outline'}
              className="text-[10px]"
            >
              {pendingApprovals.totalPendingCount} Actionable
            </Badge>
          </CardHeader>

          <CardContent className="space-y-2.5">
            <Link
              href="/expenses"
              className="p-2.5 bg-muted/40 hover:bg-muted/70 rounded-xl flex items-center justify-between text-xs transition-colors"
            >
              <span className="font-medium text-foreground">Expense Approvals</span>
              <Badge
                variant={pendingApprovals.expenseApprovals > 0 ? 'destructive' : 'secondary'}
                className="text-[10px]"
              >
                {pendingApprovals.expenseApprovals}
              </Badge>
            </Link>

            <Link
              href="/salaries"
              className="p-2.5 bg-muted/40 hover:bg-muted/70 rounded-xl flex items-center justify-between text-xs transition-colors"
            >
              <span className="font-medium text-foreground">Bonus Approvals</span>
              <Badge
                variant={pendingApprovals.bonusApprovals > 0 ? 'destructive' : 'secondary'}
                className="text-[10px]"
              >
                {pendingApprovals.bonusApprovals}
              </Badge>
            </Link>

            <Link
              href="/salaries"
              className="p-2.5 bg-muted/40 hover:bg-muted/70 rounded-xl flex items-center justify-between text-xs transition-colors"
            >
              <span className="font-medium text-foreground">Salary Reviews</span>
              <Badge
                variant={pendingApprovals.salaryReviews > 0 ? 'destructive' : 'secondary'}
                className="text-[10px]"
              >
                {pendingApprovals.salaryReviews}
              </Badge>
            </Link>

            <Link
              href="/purchases"
              className="p-2.5 bg-muted/40 hover:bg-muted/70 rounded-xl flex items-center justify-between text-xs transition-colors"
            >
              <span className="font-medium text-foreground">Purchase Orders Requiring Action</span>
              <Badge
                variant={pendingApprovals.purchaseOrdersRequiringAction > 0 ? 'destructive' : 'secondary'}
                className="text-[10px]"
              >
                {pendingApprovals.purchaseOrdersRequiringAction}
              </Badge>
            </Link>

            {/* Customer Feedback Summary */}
            <div className="pt-2 border-t border-border/40 grid grid-cols-2 gap-2 text-xs">
              <Link
                href="/reviews"
                className="p-2 bg-muted/30 hover:bg-muted/50 rounded-lg transition-colors"
              >
                <div className="text-[11px] text-muted-foreground">Reviews Rating</div>
                <div className="flex items-center gap-1 font-bold text-amber-500 mt-0.5">
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  <span>{customerFeedback.averageRating || 'N/A'}</span>
                  <span className="text-[10px] text-muted-foreground">
                    ({customerFeedback.reviewCount})
                  </span>
                </div>
              </Link>

              <Link
                href="/customers"
                className="p-2 bg-muted/30 hover:bg-muted/50 rounded-lg transition-colors"
              >
                <div className="text-[11px] text-muted-foreground">Open Issues</div>
                <div className="font-bold text-foreground mt-0.5">
                  {customerFeedback.openIssuesCount}
                  {customerFeedback.highUrgentIssuesCount > 0 && (
                    <span className="text-[10px] text-rose-500 font-normal ml-1">
                      ({customerFeedback.highUrgentIssuesCount} urgent)
                    </span>
                  )}
                </div>
              </Link>
            </div>
          </CardContent>
        </div>
      </Card>
    </div>
  );
}
