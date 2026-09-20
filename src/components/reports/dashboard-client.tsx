'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  Clock,
  ArrowRight,
  Flame,
  CreditCard,
  Building2,
  UtensilsCrossed,
  Receipt,
  FileSpreadsheet,
} from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { BranchFilter } from '@/components/reports/branch-filter';
import { ReportCard } from '@/components/reports/report-card';
import {
  DistributionDonutChart,
} from '@/components/reports/report-chart';
import type { DashboardData } from '@/lib/reports/types';
import {
  formatCurrency,
  formatNumber,
} from '@/lib/reports/constants';
import { getDashboardData } from '@/lib/reports/actions';

interface DashboardClientProps {
  initialData: DashboardData;
  branches: Array<{ id: string; name: string; code: string }>;
  userName: string;
  userRole: string;
  isBranchRestricted: boolean;
  selectedBranchId?: string;
  canViewBranches: boolean;
}

export function DashboardClient({
  initialData,
  branches,
  userName,
  userRole,
  isBranchRestricted,
  selectedBranchId = 'all',
  canViewBranches,
}: DashboardClientProps) {
  const [isPending, startTransition] = useTransition();
  const [branchId, setBranchId] = useState<string>(selectedBranchId);
  const [data, setData] = useState<DashboardData>(initialData);

  const handleBranchChange = (newBranch: string) => {
    setBranchId(newBranch);
    startTransition(async () => {
      const bId = newBranch === 'all' ? undefined : newBranch;
      const res = await getDashboardData({ branchId: bId });
      if (res.success) {
        setData(res.data);
      }
    });
  };

  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* ─── Hero / Header ────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Welcome, {userName}
            </h1>
            <Badge variant="outline" className="text-xs uppercase">
              {userRole}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {todayFormatted} • Operational Overview & Executive KPIs
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <BranchFilter
            branches={branches}
            value={branchId}
            onChange={handleBranchChange}
            isRestricted={isBranchRestricted}
          />
          <Link
            href="/sales"
            className={buttonVariants({
              size: 'sm',
              className: 'h-9 px-3 text-xs gap-1.5 font-medium rounded-xl',
            })}
          >
            Full Sales Report <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* ─── Operational Attention Badges / Alerts ─────────────────────────── */}
      {(data.lowStockCount > 0 ||
        data.pendingExpenseApprovals > 0 ||
        data.pendingSalaryReviews > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {data.lowStockCount > 0 && (
            <Link
              href="/inventory"
              className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15 transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="text-xs font-semibold text-foreground">
                  Low Stock Alert
                </span>
              </div>
              <Badge variant="secondary" className="text-xs font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                {data.lowStockCount} items
              </Badge>
            </Link>
          )}

          {data.pendingExpenseApprovals > 0 && (
            <Link
              href="/expenses"
              className="flex items-center justify-between p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/15 transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span className="text-xs font-semibold text-foreground">
                  Pending Expenses
                </span>
              </div>
              <Badge variant="secondary" className="text-xs font-bold bg-rose-500/20 text-rose-700 dark:text-rose-300">
                {data.pendingExpenseApprovals} to review
              </Badge>
            </Link>
          )}

          {data.pendingSalaryReviews > 0 && (
            <Link
              href="/salary/records"
              className="flex items-center justify-between p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500/15 transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span className="text-xs font-semibold text-foreground">
                  Pending Salary Records
                </span>
              </div>
              <Badge variant="secondary" className="text-xs font-bold bg-sky-500/20 text-sky-700 dark:text-sky-300">
                {data.pendingSalaryReviews} pending
              </Badge>
            </Link>
          )}
        </div>
      )}

      {/* ─── Today's Primary KPI Cards ────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportCard
          title="Today's Net Revenue"
          value={formatCurrency(data.todaySales)}
          subtitle="Realized sales today"
          icon={<DollarSign className="w-4 h-4" />}
          variant="primary"
          loading={isPending}
        />

        <ReportCard
          title="Completed Orders"
          value={formatNumber(data.todayOrders)}
          subtitle="Served today"
          icon={<ShoppingCart className="w-4 h-4" />}
          variant="info"
          loading={isPending}
        />

        <ReportCard
          title="Today's Expenses"
          value={formatCurrency(data.todayExpenses)}
          subtitle="Approved expenditures"
          icon={<Receipt className="w-4 h-4" />}
          variant="warning"
          loading={isPending}
        />

        <ReportCard
          title="Operating Result"
          value={formatCurrency(data.operatingResult)}
          subtitle="Revenue − Expenses"
          icon={<TrendingUp className="w-4 h-4" />}
          variant={data.operatingResult >= 0 ? 'success' : 'danger'}
          loading={isPending}
        />
      </div>

      {/* ─── Operational Charts & Insights Grid ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Top Selling Items (Takes 1 col on desktop) */}
        <Card className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden shadow-xs">
          <CardHeader className="p-5 border-b border-border/40 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold tracking-tight flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-orange-500" /> Top Sellers Today
              </CardTitle>
            </div>
            <Link
              href="/sales/products"
              className={buttonVariants({
                variant: 'ghost',
                size: 'sm',
                className: 'h-7 px-2 text-[11px]',
              })}
            >
              View All
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {data.topSellingItems.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted-foreground">
                No menu items sold yet today.
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {data.topSellingItems.map((item, idx) => (
                  <div
                    key={item.menuItemName}
                    className="flex items-center justify-between p-3.5 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="text-xs font-semibold text-foreground truncate max-w-37.5">
                          {item.menuItemName}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {item.quantitySold} units sold
                        </div>
                      </div>
                    </div>
                    <div className="text-xs font-bold text-foreground">
                      {formatCurrency(item.revenue)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Types Split (Takes 1 col on desktop) */}
        <Card className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden shadow-xs">
          <CardHeader className="p-5 border-b border-border/40">
            <CardTitle className="text-base font-semibold tracking-tight flex items-center gap-1.5">
              <UtensilsCrossed className="w-4 h-4 text-sky-500" /> Order Channels
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <DistributionDonutChart
              data={data.orderTypeBreakdown.map((ot) => ({
                name: ot.orderType.replace('_', ' '),
                value: ot.orderCount,
              }))}
              height={230}
              valueFormatter={(v) => `${v} orders`}
            />
          </CardContent>
        </Card>

        {/* Payment Methods Split (Takes 1 col on desktop) */}
        <Card className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden shadow-xs">
          <CardHeader className="p-5 border-b border-border/40">
            <CardTitle className="text-base font-semibold tracking-tight flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-emerald-500" /> Settlement Methods
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <DistributionDonutChart
              data={data.paymentBreakdown.map((pm) => ({
                name: pm.method.replace('_', ' '),
                value: pm.amount,
              }))}
              height={230}
              valueFormatter={(v) => formatCurrency(v)}
            />
          </CardContent>
        </Card>
      </div>

      {/* ─── Multi-Branch Overview (if user has permission) ───────────────── */}
      {canViewBranches && data.branchOverview.length > 0 && (
        <Card className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden shadow-xs">
          <CardHeader className="p-5 border-b border-border/40 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold tracking-tight flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-primary" /> Branch Performance Today
              </CardTitle>
            </div>
            <Link
              href="/reports/profit-loss"
              className={buttonVariants({
                variant: 'outline',
                size: 'sm',
                className: 'h-8 text-xs',
              })}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1" /> P&L Statements
            </Link>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="text-xs font-semibold">Branch</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Orders Today</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Gross Sales</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Refunds</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Net Sales</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Expenses</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.branchOverview.map((b) => (
                  <TableRow key={b.branchId} className="hover:bg-muted/30">
                    <TableCell className="text-xs font-medium">
                      <div>{b.branchName}</div>
                      <div className="text-[10px] text-muted-foreground">{b.branchCode}</div>
                    </TableCell>
                    <TableCell className="text-xs text-right font-medium">
                      {formatNumber(b.orderCount)}
                    </TableCell>
                    <TableCell className="text-xs text-right">{formatCurrency(b.grossSales)}</TableCell>
                    <TableCell className="text-xs text-right text-amber-600 dark:text-amber-400">
                      {b.refunds > 0 ? `-${formatCurrency(b.refunds)}` : '-'}
                    </TableCell>
                    <TableCell className="text-xs text-right font-bold text-foreground">
                      {formatCurrency(b.netSales)}
                    </TableCell>
                    <TableCell className="text-xs text-right text-muted-foreground">
                      {formatCurrency(b.expenses)}
                    </TableCell>
                    <TableCell
                      className={`text-xs text-right font-bold ${
                        b.operatingResult >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {formatCurrency(b.operatingResult)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
