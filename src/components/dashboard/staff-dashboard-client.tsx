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
      <div className="relative overflow-hidden rounded-2xl border bg-linear-to-r from-primary/10 via-background to-primary/5 p-6 md:p-8">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Staff Terminal
              </span>
              <span className="text-muted-foreground">•</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Building2 className="size-3" />
                {data.employee.branchName}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Welcome, {data.employee.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {data.employee.designation} • Code: {data.employee.employeeCode}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border bg-background/80 px-3.5 py-2 backdrop-blur-sm">
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
              className={buttonVariants({ size: 'lg', className: 'gap-2 shadow-md' })}
            >
              <PlusCircle className="size-4" />
              New POS Order
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Operations KPI Strip */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Orders Today</span>
            <ShoppingCart className="size-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {data.orderMetrics.totalToday}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Total tickets raised today
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">In Preparation</span>
            <Clock className="size-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {data.orderMetrics.activeOrders}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Kitchen active orders
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Ready for Pickup</span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {data.orderMetrics.readyForPickup}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Awaiting customer handover
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Kitchen Backlog</span>
            <ChefHat className="size-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {data.kitchenQueueCount}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Live KDS queue items
          </div>
        </div>
      </div>

      {/* 3. Operational Quick Actions */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">
          Quick Workspaces
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Link
            href="/staff/orders"
            className="group flex flex-col items-center justify-center rounded-xl border bg-card p-4 text-center transition-all hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm"
          >
            <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform group-hover:scale-110">
              <ShoppingCart className="size-5" />
            </div>
            <span className="mt-2 text-xs font-semibold text-foreground">
              Orders & POS
            </span>
            <span className="text-[10px] text-muted-foreground">
              Create & manage
            </span>
          </Link>

          <Link
            href="/staff/kitchen"
            className="group flex flex-col items-center justify-center rounded-xl border bg-card p-4 text-center transition-all hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm"
          >
            <div className="flex size-11 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-500 transition-transform group-hover:scale-110">
              <ChefHat className="size-5" />
            </div>
            <span className="mt-2 text-xs font-semibold text-foreground">
              Kitchen KDS
            </span>
            <span className="text-[10px] text-muted-foreground">
              Live preparation
            </span>
          </Link>

          <Link
            href="/staff/attendance"
            className="group flex flex-col items-center justify-center rounded-xl border bg-card p-4 text-center transition-all hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm"
          >
            <div className="flex size-11 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 transition-transform group-hover:scale-110">
              <UserCheck className="size-5" />
            </div>
            <span className="mt-2 text-xs font-semibold text-foreground">
              Shift Clock
            </span>
            <span className="text-[10px] text-muted-foreground">
              Mark attendance
            </span>
          </Link>

          <Link
            href="/staff/menu"
            className="group flex flex-col items-center justify-center rounded-xl border bg-card p-4 text-center transition-all hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm"
          >
            <div className="flex size-11 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 transition-transform group-hover:scale-110">
              <UtensilsCrossed className="size-5" />
            </div>
            <span className="mt-2 text-xs font-semibold text-foreground">
              Menu Card
            </span>
            <span className="text-[10px] text-muted-foreground">
              Items & stock
            </span>
          </Link>

          <Link
            href="/staff/expenses"
            className="group flex flex-col items-center justify-center rounded-xl border bg-card p-4 text-center transition-all hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm"
          >
            <div className="flex size-11 items-center justify-center rounded-full bg-rose-500/10 text-rose-500 transition-transform group-hover:scale-110">
              <Receipt className="size-5" />
            </div>
            <span className="mt-2 text-xs font-semibold text-foreground">
              Petty Cash
            </span>
            <span className="text-[10px] text-muted-foreground">
              Record expense
            </span>
          </Link>
        </div>
      </div>

      {/* 4. Recent Shift Orders */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-3.5">
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
            className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'gap-1 text-xs' })}
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
          <div className="divide-y">
            {data.recentOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between px-5 py-3 text-sm transition-colors hover:bg-muted/30"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">
                      #{order.orderNumber}
                    </span>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {order.orderType}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {order.customerName} • {order.createdAt}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="font-semibold text-foreground">
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
                    className="text-xs"
                  >
                    {order.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
