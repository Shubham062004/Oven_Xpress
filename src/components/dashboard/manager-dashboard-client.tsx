'use client';

import React from 'react';
import Link from 'next/link';
import {
  DollarSign,
  ShoppingCart,
  Users,
  AlertTriangle,
  ArrowRight,
  Package,
  CalendarCheck,
  Receipt,
  FileSpreadsheet,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ManagerDashboardData } from '@/lib/reports/manager-dashboard-service';

interface ManagerDashboardClientProps {
  data: ManagerDashboardData;
}

export function ManagerDashboardClient({ data }: ManagerDashboardClientProps) {
  return (
    <div className="space-y-6">
      {/* 1. Branch Header */}
      <div className="relative overflow-hidden rounded-2xl border bg-linear-to-r from-emerald-500/10 via-background to-teal-500/5 p-4 sm:p-6 md:p-8">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                Branch Manager Console
              </Badge>
              <span className="text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">{data.branch.city}</span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              {data.branch.name} ({data.branch.code})
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Daily branch operations, shift allocation, and real-time sales ledger.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
            <Link
              href="/manager/orders"
              className={buttonVariants({
                size: 'lg',
                className: 'w-full sm:w-auto min-h-11 h-11 text-sm font-semibold justify-center gap-2 shadow-md',
              })}
            >
              <ShoppingCart className="size-4" />
              Live Order Book
            </Link>
            <Link
              href="/manager/inventory"
              className={buttonVariants({
                variant: 'outline',
                size: 'lg',
                className: 'w-full sm:w-auto min-h-11 h-11 text-sm font-semibold justify-center gap-2',
              })}
            >
              <Package className="size-4" />
              Stock Check
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Operations KPI Cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-4 min-w-0 w-full">
        <div className="rounded-xl border bg-card p-3.5 sm:p-4 shadow-xs min-w-0">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] sm:text-xs font-medium">Today&apos;s Sales</span>
            <DollarSign className="size-4 text-emerald-500 shrink-0" />
          </div>
          <div className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold text-foreground truncate">
            ₹{data.metrics.todayRevenue.toLocaleString()}
          </div>
          <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-[11px] text-muted-foreground truncate">
            {data.metrics.todayOrdersCount} orders placed today
          </div>
        </div>

        <div className="rounded-xl border bg-card p-3.5 sm:p-4 shadow-xs min-w-0">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] sm:text-xs font-medium">Active Kitchen Orders</span>
            <Clock className="size-4 text-amber-500 shrink-0" />
          </div>
          <div className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400">
            {data.metrics.activeOrdersCount}
          </div>
          <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-[11px] text-muted-foreground truncate">
            Pending & in preparation
          </div>
        </div>

        <div className="rounded-xl border bg-card p-3.5 sm:p-4 shadow-xs min-w-0">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] sm:text-xs font-medium">Staff on Duty</span>
            <Users className="size-4 text-blue-500 shrink-0" />
          </div>
          <div className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold text-foreground">
            {data.metrics.staffClockedInCount}{' '}
            <span className="text-xs sm:text-sm font-normal text-muted-foreground">
              / {data.metrics.totalBranchStaff}
            </span>
          </div>
          <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-[11px] text-muted-foreground truncate">
            Clocked in staff today
          </div>
        </div>

        <div className="rounded-xl border bg-card p-3.5 sm:p-4 shadow-xs min-w-0">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] sm:text-xs font-medium">Low Stock Items</span>
            <AlertTriangle className="size-4 text-rose-500 shrink-0" />
          </div>
          <div className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400">
            {data.metrics.lowStockItemsCount}
          </div>
          <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-[11px] text-muted-foreground truncate">
            Items below reorder limit
          </div>
        </div>
      </div>

      {/* 3. Quick Navigation */}
      <div className="space-y-3 min-w-0 w-full">
        <h2 className="text-sm sm:text-base font-semibold text-foreground">
          Branch Management Shortcuts
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
          <Link
            href="/manager/orders"
            className="group flex flex-col items-center justify-center rounded-xl border bg-card p-3 sm:p-3.5 text-center transition-all hover:border-primary/50 hover:bg-primary/5 min-h-18 sm:min-h-20 min-w-0"
          >
            <ShoppingCart className="size-5 text-primary group-hover:scale-110 transition-transform" />
            <span className="mt-1.5 sm:mt-2 text-xs font-semibold truncate max-w-full">Orders</span>
          </Link>
          <Link
            href="/manager/inventory"
            className="group flex flex-col items-center justify-center rounded-xl border bg-card p-3 sm:p-3.5 text-center transition-all hover:border-indigo-500/50 hover:bg-indigo-500/5 min-h-18 sm:min-h-20 min-w-0"
          >
            <Package className="size-5 text-indigo-500 group-hover:scale-110 transition-transform" />
            <span className="mt-1.5 sm:mt-2 text-xs font-semibold truncate max-w-full">Inventory</span>
          </Link>
          <Link
            href="/manager/attendance"
            className="group flex flex-col items-center justify-center rounded-xl border bg-card p-3 sm:p-3.5 text-center transition-all hover:border-emerald-500/50 hover:bg-emerald-500/5 min-h-18 sm:min-h-20 min-w-0"
          >
            <CalendarCheck className="size-5 text-emerald-500 group-hover:scale-110 transition-transform" />
            <span className="mt-1.5 sm:mt-2 text-xs font-semibold truncate max-w-full">Attendance</span>
          </Link>
          <Link
            href="/manager/employees"
            className="group flex flex-col items-center justify-center rounded-xl border bg-card p-3 sm:p-3.5 text-center transition-all hover:border-amber-500/50 hover:bg-amber-500/5 min-h-18 sm:min-h-20 min-w-0"
          >
            <Users className="size-5 text-amber-500 group-hover:scale-110 transition-transform" />
            <span className="mt-1.5 sm:mt-2 text-xs font-semibold truncate max-w-full">Staff</span>
          </Link>
          <Link
            href="/manager/expenses"
            className="group flex flex-col items-center justify-center rounded-xl border bg-card p-3 sm:p-3.5 text-center transition-all hover:border-rose-500/50 hover:bg-rose-500/5 min-h-18 sm:min-h-20 min-w-0"
          >
            <Receipt className="size-5 text-rose-500 group-hover:scale-110 transition-transform" />
            <span className="mt-1.5 sm:mt-2 text-xs font-semibold truncate max-w-full">Expenses</span>
          </Link>
          <Link
            href="/manager/reports"
            className="group flex flex-col items-center justify-center rounded-xl border bg-card p-3 sm:p-3.5 text-center transition-all hover:border-teal-500/50 hover:bg-teal-500/5 min-h-18 sm:min-h-20 min-w-0"
          >
            <FileSpreadsheet className="size-5 text-teal-500 group-hover:scale-110 transition-transform" />
            <span className="mt-1.5 sm:mt-2 text-xs font-semibold truncate max-w-full">Reports</span>
          </Link>
        </div>
      </div>

      {/* 4. Split Section: Live Orders & Low Inventory */}
      <div className="grid gap-6 lg:grid-cols-2 min-w-0 w-full">
        {/* Recent Branch Orders */}
        <div className="rounded-xl border bg-card shadow-xs">
          <div className="flex items-center justify-between border-b px-4 sm:px-5 py-3 sm:py-3.5">
            <h3 className="text-sm font-semibold text-foreground">
              Recent Branch Orders
            </h3>
            <Link
              href="/manager/orders"
              className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'gap-1 text-xs min-h-8' })}
            >
              View All
              <ArrowRight className="size-3.5" />
            </Link>
          </div>

          {data.recentOrders.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No orders today yet.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {data.recentOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/manager/orders/${order.id}`}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3.5 sm:px-5 sm:py-3 text-sm transition-colors hover:bg-muted/40 cursor-pointer min-h-11 gap-2"
                >
                  <div className="flex items-center justify-between sm:justify-start gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground hover:underline">
                          #{order.orderNumber}
                        </span>
                        <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0">
                          {order.orderType}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {order.customerName} • {order.createdAt}
                      </div>
                    </div>
                    {/* On mobile: show total amount next to customer */}
                    <div className="sm:hidden font-bold text-foreground">
                      ₹{order.totalAmount.toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-1 sm:pt-0 border-t sm:border-t-0 border-border/30">
                    <span className="hidden sm:inline font-bold text-foreground">
                      ₹{order.totalAmount.toLocaleString()}
                    </span>
                    <Badge
                      variant={
                        order.status === 'COMPLETED'
                          ? 'default'
                          : order.status === 'READY'
                          ? 'secondary'
                          : 'outline'
                      }
                      className="text-xs font-semibold"
                    >
                      {order.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div className="rounded-xl border bg-card shadow-xs">
          <div className="flex items-center justify-between border-b px-4 sm:px-5 py-3 sm:py-3.5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-rose-500" />
              <h3 className="text-sm font-semibold text-foreground">
                Low Stock Thresholds
              </h3>
            </div>
            <Link
              href="/manager/inventory"
              className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'gap-1 text-xs min-h-8' })}
            >
              Inventory
              <ArrowRight className="size-3.5" />
            </Link>
          </div>

          {data.lowStockItems.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="mx-auto size-8 text-emerald-500 mb-2" />
              All ingredient stocks are currently above minimum safety thresholds.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {data.lowStockItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3.5 sm:px-5 sm:py-3 text-sm min-h-11 gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-foreground truncate">{item.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Min: {item.minThreshold} {item.unit}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant="destructive" className="font-semibold text-xs">
                      {item.currentStock} {item.unit} left
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
