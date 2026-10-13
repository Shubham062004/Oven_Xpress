'use client';

import React from 'react';
import Link from 'next/link';
import {
  ShoppingCart,
  ChefHat,
  UserCheck,
  UtensilsCrossed,
  Receipt,
  PlusCircle,
  Clock,
  CheckCircle2,
  Building2,
  ArrowRight,
} from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { StaffDashboardData } from '@/lib/reports/staff-dashboard-service';

interface StaffDashboardClientProps {
  data: StaffDashboardData;
}

export function StaffDashboardClient({ data }: StaffDashboardClientProps) {
  const isClockedIn = data.todayAttendance?.status === 'PRESENT' || Boolean(data.todayAttendance?.checkInTime && !data.todayAttendance?.checkOutTime);

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border bg-linear-to-r from-primary/10 via-background to-primary/5 p-4 sm:p-6 md:p-8">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-primary">
                Staff Terminal
              </span>
              <span className="text-muted-foreground">•</span>
              <span className="flex items-center gap-1 text-[11px] sm:text-xs text-muted-foreground">
                <Building2 className="size-3" />
                {data.employee.branchName}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Welcome, {data.employee.name}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {data.employee.designation} • Code: {data.employee.employeeCode}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
            <div className="flex items-center justify-center sm:justify-start gap-2 rounded-xl border bg-background/80 px-3.5 py-2.5 min-h-11 backdrop-blur-sm">
              <div
                className={`size-2.5 rounded-full ${
                  isClockedIn ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <span className="text-xs font-medium">
                {isClockedIn
                  ? `Clocked In (${data.todayAttendance?.checkInTime || 'Active'})`
                  : 'Not Clocked In Today'}
              </span>
            </div>

            <Link
              href="/staff/orders/new"
              className={buttonVariants({
                size: 'lg',
                className:
                  'w-full sm:w-auto min-h-11 h-11 text-sm font-semibold justify-center gap-2 shadow-md',
              })}
            >
              <PlusCircle className="size-4" />
              New POS Order
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Operations KPI Strip */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-4 min-w-0 w-full">
        <div className="rounded-xl border bg-card p-3 sm:p-4 shadow-xs min-w-0">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] sm:text-xs font-medium">Orders Today</span>
            <ShoppingCart className="size-4 text-primary shrink-0" />
          </div>
          <div className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold text-foreground">
            {data.orderMetrics.totalToday}
          </div>
          <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-[11px] text-muted-foreground truncate">
            Total tickets raised today
          </div>
        </div>

        <div className="rounded-xl border bg-card p-3 sm:p-4 shadow-xs min-w-0">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] sm:text-xs font-medium">In Preparation</span>
            <Clock className="size-4 text-amber-500 shrink-0" />
          </div>
          <div className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400">
            {data.orderMetrics.activeOrders}
          </div>
          <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-[11px] text-muted-foreground truncate">
            Kitchen active orders
          </div>
        </div>

        <div className="rounded-xl border bg-card p-3 sm:p-4 shadow-xs min-w-0">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] sm:text-xs font-medium">Ready for Pickup</span>
            <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
          </div>
          <div className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {data.orderMetrics.readyForPickup}
          </div>
          <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-[11px] text-muted-foreground truncate">
            Awaiting handover
          </div>
        </div>

        <div className="rounded-xl border bg-card p-3 sm:p-4 shadow-xs min-w-0">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] sm:text-xs font-medium">Kitchen Backlog</span>
            <ChefHat className="size-4 text-indigo-500 shrink-0" />
          </div>
          <div className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {data.kitchenQueueCount}
          </div>
          <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-[11px] text-muted-foreground truncate">
            Live KDS queue items
          </div>
        </div>
      </div>

      {/* 3. Operational Quick Workspaces */}
      <div className="space-y-3 min-w-0 w-full">
        <h2 className="text-sm sm:text-base font-semibold text-foreground">
          Quick Workspaces
        </h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5 min-w-0 w-full">
          {/* Primary POS Terminal - Prominent on mobile */}
          <Link
            href="/staff/orders"
            className="col-span-2 sm:col-span-1 group flex sm:flex-col items-center justify-start sm:justify-center gap-3 sm:gap-0 rounded-xl border border-primary/30 bg-primary/5 p-3.5 sm:p-4 text-left sm:text-center transition-all hover:border-primary hover:bg-primary/10 hover:shadow-xs min-h-14 sm:min-h-25"
          >
            <div className="flex size-10 sm:size-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary transition-transform group-hover:scale-110">
              <ShoppingCart className="size-5" />
            </div>
            <div>
              <span className="block text-xs sm:text-xs font-bold text-foreground">
                Orders & POS
              </span>
              <span className="block text-[10px] sm:text-[10px] text-muted-foreground">
                Create & manage tickets
              </span>
            </div>
          </Link>

          <Link
            href="/staff/kitchen"
            className="group flex flex-col items-center justify-center rounded-xl border bg-card p-3 sm:p-4 text-center transition-all hover:border-indigo-500/50 hover:bg-indigo-500/5 hover:shadow-xs min-h-18 sm:min-h-25"
          >
            <div className="flex size-9 sm:size-11 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-500 transition-transform group-hover:scale-110">
              <ChefHat className="size-4 sm:size-5" />
            </div>
            <span className="mt-1.5 sm:mt-2 text-xs font-semibold text-foreground">
              Kitchen KDS
            </span>
            <span className="text-[10px] text-muted-foreground hidden sm:block">
              Live preparation
            </span>
          </Link>

          <Link
            href="/staff/attendance"
            className="group flex flex-col items-center justify-center rounded-xl border bg-card p-3 sm:p-4 text-center transition-all hover:border-emerald-500/50 hover:bg-emerald-500/5 hover:shadow-xs min-h-18 sm:min-h-25"
          >
            <div className="flex size-9 sm:size-11 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 transition-transform group-hover:scale-110">
              <UserCheck className="size-4 sm:size-5" />
            </div>
            <span className="mt-1.5 sm:mt-2 text-xs font-semibold text-foreground">
              Shift Clock
            </span>
            <span className="text-[10px] text-muted-foreground hidden sm:block">
              Mark attendance
            </span>
          </Link>

          <Link
            href="/staff/menu"
            className="group flex flex-col items-center justify-center rounded-xl border bg-card p-3 sm:p-4 text-center transition-all hover:border-amber-500/50 hover:bg-amber-500/5 hover:shadow-xs min-h-18 sm:min-h-25"
          >
            <div className="flex size-9 sm:size-11 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 transition-transform group-hover:scale-110">
              <UtensilsCrossed className="size-4 sm:size-5" />
            </div>
            <span className="mt-1.5 sm:mt-2 text-xs font-semibold text-foreground">
              Menu Card
            </span>
            <span className="text-[10px] text-muted-foreground hidden sm:block">
              Items & stock
            </span>
          </Link>

          <Link
            href="/staff/expenses"
            className="col-span-2 sm:col-span-1 group flex sm:flex-col items-center justify-start sm:justify-center gap-3 sm:gap-0 rounded-xl border bg-card p-3 sm:p-4 text-left sm:text-center transition-all hover:border-rose-500/50 hover:bg-rose-500/5 hover:shadow-xs min-h-14 sm:min-h-25"
          >
            <div className="flex size-9 sm:size-11 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-500 transition-transform group-hover:scale-110">
              <Receipt className="size-4 sm:size-5" />
            </div>
            <div>
              <span className="block text-xs font-semibold text-foreground">
                Petty Cash
              </span>
              <span className="block text-[10px] text-muted-foreground">
                Record expense receipt
              </span>
            </div>
          </Link>
        </div>
      </div>

      {/* 4. Recent Shift Orders */}
      <div className="rounded-xl border bg-card shadow-xs">
        <div className="flex items-center justify-between border-b px-4 sm:px-5 py-3 sm:py-3.5">
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-foreground">
              Recent Orders Today
            </h3>
            <p className="text-xs text-muted-foreground">
              Latest order tickets generated at your branch
            </p>
          </div>
          <Link
            href="/staff/orders"
            className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'gap-1 text-xs min-h-9' })}
          >
            View All
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        {data.recentOrders.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No orders placed yet today. Click &quot;New POS Order&quot; above to begin.
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {data.recentOrders.map((order) => (
              <Link
                key={order.id}
                href={`/staff/orders/${order.id}`}
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
                  {/* On mobile: show total amount next to title */}
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
                  <ArrowRight className="size-3.5 text-muted-foreground/60 hidden sm:inline" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
