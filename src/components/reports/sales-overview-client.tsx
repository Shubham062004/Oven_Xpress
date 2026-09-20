'use client';

import React, { useState, useTransition } from 'react';
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Receipt,
  CreditCard,
  RotateCcw,
  Building2,
  PieChart as PieIcon,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DateRangePicker } from '@/components/reports/date-range-picker';
import { BranchFilter } from '@/components/reports/branch-filter';
import { ReportCard } from '@/components/reports/report-card';
import { ReportTableWrapper } from '@/components/reports/report-table';
import {
  RevenueTrendChart,
  HourlyBarChart,
  DistributionDonutChart,
} from '@/components/reports/report-chart';
import type {
  ReportDateRange,
  DateRangePreset,
  SalesOverview,
  DailySalesRow,
  OrderTypeSalesRow,
  PaymentMethodBreakdown,
  HourlyBreakdownRow,
  RevenueTimePoint,
  BranchSalesRow,
} from '@/lib/reports/types';
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  downloadCSV,
} from '@/lib/reports/constants';
import {
  getSalesOverview,
  getDailySalesMetrics,
  getOrderTypeSales,
  getPaymentMethodBreakdown,
  getHourlySalesBreakdown,
  getRevenueOverTime,
  getBranchSalesComparison,
  exportSalesCSV,
} from '@/lib/reports/actions';

interface SalesOverviewClientProps {
  initialOverview: SalesOverview;
  initialDailySales: DailySalesRow[];
  initialOrderTypes: OrderTypeSalesRow[];
  initialPaymentMethods: PaymentMethodBreakdown;
  initialHourly: HourlyBreakdownRow[];
  initialRevenueTrend: RevenueTimePoint[];
  initialBranchComparison: BranchSalesRow[];
  branches: Array<{ id: string; name: string; code: string }>;
  canViewBranchComparison: boolean;
  isBranchRestricted: boolean;
  selectedBranchId?: string;
  initialDateRange: ReportDateRange;
  initialPreset?: DateRangePreset;
}

export function SalesOverviewClient({
  initialOverview,
  initialDailySales,
  initialOrderTypes,
  initialPaymentMethods,
  initialHourly,
  initialRevenueTrend,
  initialBranchComparison,
  branches,
  canViewBranchComparison,
  isBranchRestricted,
  selectedBranchId = 'all',
  initialDateRange,
  initialPreset = 'today',
}: SalesOverviewClientProps) {
  const [isPending, startTransition] = useTransition();
  const [dateRange, setDateRange] = useState<ReportDateRange>(initialDateRange);
  const [preset, setPreset] = useState<DateRangePreset>(initialPreset);
  const [branchId, setBranchId] = useState<string>(selectedBranchId);

  // Report state
  const [overview, setOverview] = useState<SalesOverview>(initialOverview);
  const [dailySales, setDailySales] = useState<DailySalesRow[]>(initialDailySales);
  const [orderTypes, setOrderTypes] = useState<OrderTypeSalesRow[]>(initialOrderTypes);
  const [paymentMethods, setPaymentMethods] =
    useState<PaymentMethodBreakdown>(initialPaymentMethods);
  const [hourly, setHourly] = useState<HourlyBreakdownRow[]>(initialHourly);
  const [revenueTrend, setRevenueTrend] =
    useState<RevenueTimePoint[]>(initialRevenueTrend);
  const [branchComparison, setBranchComparison] =
    useState<BranchSalesRow[]>(initialBranchComparison);

  const [exportLoading, setExportLoading] = useState(false);

  // Refetch all data for updated filters
  const reloadData = (newBranch: string, newRange: ReportDateRange) => {
    startTransition(async () => {
      const bId = newBranch === 'all' ? undefined : newBranch;
      const [
        overviewRes,
        dailyRes,
        orderTypeRes,
        paymentRes,
        hourlyRes,
        trendRes,
        branchRes,
      ] = await Promise.all([
        getSalesOverview({ branchId: bId, dateRange: newRange }),
        getDailySalesMetrics({ branchId: bId, dateRange: newRange }),
        getOrderTypeSales({ branchId: bId, dateRange: newRange }),
        getPaymentMethodBreakdown({ branchId: bId, dateRange: newRange }),
        getHourlySalesBreakdown({ branchId: bId, dateRange: newRange }),
        getRevenueOverTime({ branchId: bId, dateRange: newRange }),
        canViewBranchComparison
          ? getBranchSalesComparison({ dateRange: newRange })
          : Promise.resolve({ success: true, data: [] }),
      ]);

      if (overviewRes.success) setOverview(overviewRes.data);
      if (dailyRes.success) setDailySales(dailyRes.data);
      if (orderTypeRes.success) setOrderTypes(orderTypeRes.data);
      if (paymentRes.success) setPaymentMethods(paymentRes.data);
      if (hourlyRes.success) setHourly(hourlyRes.data);
      if (trendRes.success) setRevenueTrend(trendRes.data);
      if (branchRes.success) setBranchComparison(branchRes.data);
    });
  };

  const handleRangeChange = (range: ReportDateRange, newPreset: DateRangePreset) => {
    setDateRange(range);
    setPreset(newPreset);
    reloadData(branchId, range);
  };

  const handleBranchChange = (newBranch: string) => {
    setBranchId(newBranch);
    reloadData(newBranch, dateRange);
  };

  const handleExportCSV = async () => {
    setExportLoading(true);
    try {
      const res = await exportSalesCSV({
        branchId: branchId === 'all' ? undefined : branchId,
        dateRange,
      });
      if (res.success && res.data) {
        const filename = `sales-report-${dateRange.startDate}-to-${dateRange.endDate}.csv`;
        downloadCSV(res.data, filename);
      }
    } catch (err) {
      console.error('Failed to export CSV', err);
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Header Controls ──────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-2 border-b border-border/40">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Sales & Revenue Reports
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Operational sales metrics, order distributions, payment reconciliation, and revenue trends.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <BranchFilter
            branches={branches}
            value={branchId}
            onChange={handleBranchChange}
            isRestricted={isBranchRestricted}
          />
          <DateRangePicker
            value={dateRange}
            preset={preset}
            onChange={handleRangeChange}
          />
        </div>
      </div>

      {/* ─── KPI Cards Grid ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportCard
          title="Gross Sales"
          value={formatCurrency(overview.grossSales)}
          subtitle={`${formatNumber(overview.completedOrders)} completed orders`}
          icon={<DollarSign className="w-4 h-4" />}
          variant="primary"
          loading={isPending}
        />

        <ReportCard
          title="Net Revenue"
          value={formatCurrency(overview.netRevenue)}
          subtitle={`Discounts: ${formatCurrency(overview.discounts)}`}
          icon={<TrendingUp className="w-4 h-4" />}
          variant="success"
          loading={isPending}
        />

        <ReportCard
          title="Avg Order Value"
          value={formatCurrency(overview.averageOrderValue)}
          subtitle={`${overview.cancelledOrders} cancelled orders`}
          icon={<ShoppingCart className="w-4 h-4" />}
          variant="info"
          loading={isPending}
        />

        <ReportCard
          title="Operating Result"
          value={formatCurrency(overview.operatingResult)}
          subtitle={`Costs: ${formatCurrency(overview.approvedExpenses + overview.approvedSalary)}`}
          icon={
            overview.operatingResult >= 0 ? (
              <ArrowUpRight className="w-4 h-4" />
            ) : (
              <ArrowDownRight className="w-4 h-4" />
            )
          }
          variant={overview.operatingResult >= 0 ? 'success' : 'danger'}
          loading={isPending}
        />

        <ReportCard
          title="Total Orders"
          value={formatNumber(overview.totalOrders)}
          subtitle={`${overview.completedOrders} completed • ${overview.cancelledOrders} cancelled`}
          icon={<Receipt className="w-4 h-4" />}
          loading={isPending}
        />

        <ReportCard
          title="Payments Collected"
          value={formatCurrency(overview.successfulPayments)}
          subtitle={`${formatCurrency(overview.failedPayments)} failed attempts`}
          icon={<CreditCard className="w-4 h-4" />}
          loading={isPending}
        />

        <ReportCard
          title="Refunds Issued"
          value={formatCurrency(overview.refunds)}
          subtitle="Deducted from gross sales"
          icon={<RotateCcw className="w-4 h-4" />}
          variant="warning"
          loading={isPending}
        />

        <ReportCard
          title="Approved Expenses"
          value={formatCurrency(overview.approvedExpenses)}
          subtitle={`Salary: ${formatCurrency(overview.approvedSalary)}`}
          icon={<Building2 className="w-4 h-4" />}
          variant="default"
          loading={isPending}
        />
      </div>

      {/* ─── Detailed Report Tabs ─────────────────────────────────────────── */}
      <Tabs defaultValue="daily" className="space-y-4">
        <TabsList className="bg-card/70 border border-border/60 p-1 rounded-xl">
          <TabsTrigger value="daily" className="text-xs rounded-lg gap-1.5">
            <Receipt className="w-3.5 h-3.5" /> Daily Sales
          </TabsTrigger>
          <TabsTrigger value="trends" className="text-xs rounded-lg gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" /> Trends & Hourly
          </TabsTrigger>
          <TabsTrigger value="breakdown" className="text-xs rounded-lg gap-1.5">
            <PieIcon className="w-3.5 h-3.5" /> Types & Payments
          </TabsTrigger>
          {canViewBranchComparison && (
            <TabsTrigger value="branches" className="text-xs rounded-lg gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Branch Comparison
            </TabsTrigger>
          )}
        </TabsList>

        {/* ─── Daily Sales Tab ────────────────────────────────────────────── */}
        <TabsContent value="daily" className="space-y-4">
          <ReportTableWrapper
            title="Daily Sales Ledger"
            description="Day-by-day operational breakdown of orders, revenue, discounts, and average ticket size."
            onExportCSV={handleExportCSV}
            exportLoading={exportLoading}
            loading={isPending}
            empty={dailySales.length === 0}
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="text-xs font-semibold">Date</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Total Orders</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Completed</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Cancelled</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Gross Sales</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Discounts</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Refunds</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Net Sales</TableHead>
                    <TableHead className="text-xs font-semibold text-right">AOV</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailySales.map((row) => (
                    <TableRow key={row.date} className="hover:bg-muted/30">
                      <TableCell className="text-xs font-medium">{row.date}</TableCell>
                      <TableCell className="text-xs text-right">{row.totalOrders}</TableCell>
                      <TableCell className="text-xs text-right font-medium text-emerald-600 dark:text-emerald-400">
                        {row.completedOrders}
                      </TableCell>
                      <TableCell className="text-xs text-right text-rose-500">
                        {row.cancelledOrders > 0 ? row.cancelledOrders : '-'}
                      </TableCell>
                      <TableCell className="text-xs text-right font-medium">
                        {formatCurrency(row.grossSales)}
                      </TableCell>
                      <TableCell className="text-xs text-right text-muted-foreground">
                        {row.discounts > 0 ? `-${formatCurrency(row.discounts)}` : '-'}
                      </TableCell>
                      <TableCell className="text-xs text-right text-amber-600 dark:text-amber-400">
                        {row.refunds > 0 ? `-${formatCurrency(row.refunds)}` : '-'}
                      </TableCell>
                      <TableCell className="text-xs text-right font-bold text-foreground">
                        {formatCurrency(row.netSales)}
                      </TableCell>
                      <TableCell className="text-xs text-right text-muted-foreground font-medium">
                        {formatCurrency(row.averageOrderValue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ReportTableWrapper>
        </TabsContent>

        {/* ─── Trends & Hourly Tab ────────────────────────────────────────── */}
        <TabsContent value="trends" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ReportTableWrapper
              title="Revenue Trend"
              description="Daily revenue trajectory across the selected timeframe."
            >
              <div className="p-4">
                <RevenueTrendChart data={revenueTrend} height={280} />
              </div>
            </ReportTableWrapper>

            <ReportTableWrapper
              title="Hourly Sales Velocity"
              description="Order volume and sales clustered by hour of the day (0:00 to 23:00)."
            >
              <div className="p-4">
                <HourlyBarChart data={hourly} height={280} />
              </div>
            </ReportTableWrapper>
          </div>
        </TabsContent>

        {/* ─── Types & Payments Tab ───────────────────────────────────────── */}
        <TabsContent value="breakdown" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Order Type Distribution */}
            <ReportTableWrapper
              title="Order Type Breakdown"
              description="Dine-in, Takeaway, and Delivery order split."
            >
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 items-center gap-4">
                <DistributionDonutChart
                  data={orderTypes.map((ot) => ({
                    name: ot.orderType.replace('_', ' '),
                    value: ot.orderCount,
                  }))}
                  height={220}
                  valueFormatter={(v) => `${v} orders`}
                />

                <div className="space-y-2.5">
                  {orderTypes.map((ot) => (
                    <div
                      key={ot.orderType}
                      className="p-3 bg-muted/20 border border-border/40 rounded-xl space-y-1"
                    >
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span>{ot.orderType.replace('_', ' ')}</span>
                        <Badge variant="outline" className="text-[10px] h-5">
                          {formatPercent(ot.percentage)}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{ot.orderCount} orders</span>
                        <span className="font-medium text-foreground">
                          {formatCurrency(ot.revenue)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ReportTableWrapper>

            {/* Payment Method Breakdown */}
            <ReportTableWrapper
              title="Payment Methods"
              description="Collections grouped by settlement method, failed transactions, and refunds."
            >
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 items-center gap-4">
                <DistributionDonutChart
                  data={paymentMethods.methods.map((pm) => ({
                    name: pm.method.replace('_', ' '),
                    value: pm.amount,
                  }))}
                  height={220}
                  valueFormatter={(v) => formatCurrency(v)}
                />

                <div className="space-y-2">
                  <div className="space-y-1.5 max-h-55 overflow-y-auto pr-1">
                    {paymentMethods.methods.map((pm) => (
                      <div
                        key={pm.method}
                        className="flex items-center justify-between p-2.5 bg-muted/20 border border-border/40 rounded-lg text-xs"
                      >
                        <span className="font-medium">{pm.method.replace('_', ' ')}</span>
                        <div className="text-right">
                          <div className="font-bold text-foreground">
                            {formatCurrency(pm.amount)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {pm.count} transactions
                          </div>
                        </div>
                      </div>
                    ))}

                    {paymentMethods.failedPayments.count > 0 && (
                      <div className="flex items-center justify-between p-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-600 dark:text-rose-400">
                        <span>Failed Payments</span>
                        <span className="font-semibold">
                          {paymentMethods.failedPayments.count} (
                          {formatCurrency(paymentMethods.failedPayments.amount)})
                        </span>
                      </div>
                    )}

                    {paymentMethods.refundedAmount > 0 && (
                      <div className="flex items-center justify-between p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-600 dark:text-amber-400">
                        <span>Refunded Amount</span>
                        <span className="font-semibold">
                          -{formatCurrency(paymentMethods.refundedAmount)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </ReportTableWrapper>
          </div>
        </TabsContent>

        {/* ─── Branch Comparison Tab ──────────────────────────────────────── */}
        {canViewBranchComparison && (
          <TabsContent value="branches" className="space-y-4">
            <ReportTableWrapper
              title="Multi-Branch Performance"
              description="Direct comparison of orders, gross/net sales, expenses, and operating results across branches."
              loading={isPending}
              empty={branchComparison.length === 0}
            >
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="text-xs font-semibold">Branch</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Orders</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Gross Sales</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Refunds</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Net Sales</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Operating Expenses</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Operating Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branchComparison.map((b) => (
                      <TableRow key={b.branchId} className="hover:bg-muted/30">
                        <TableCell className="text-xs font-medium">
                          <div>{b.branchName}</div>
                          <div className="text-[10px] text-muted-foreground">{b.branchCode}</div>
                        </TableCell>
                        <TableCell className="text-xs text-right font-medium">
                          {formatNumber(b.orderCount)}
                        </TableCell>
                        <TableCell className="text-xs text-right">
                          {formatCurrency(b.grossSales)}
                        </TableCell>
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
              </div>
            </ReportTableWrapper>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
