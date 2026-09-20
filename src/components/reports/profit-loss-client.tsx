'use client';

import React, { useState, useTransition } from 'react';
import {
  DollarSign,
  AlertCircle,
  Building2,
  Users,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownRight,
  FileSpreadsheet,
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DateRangePicker } from '@/components/reports/date-range-picker';
import { BranchFilter } from '@/components/reports/branch-filter';
import { ReportCard } from '@/components/reports/report-card';
import { ReportTableWrapper } from '@/components/reports/report-table';
import { DistributionDonutChart } from '@/components/reports/report-chart';
import type {
  ReportDateRange,
  DateRangePreset,
  ProfitLossStatement,
  PurchaseReportRow,
} from '@/lib/reports/types';
import {
  formatCurrency,
  formatPercent,
  downloadCSV,
} from '@/lib/reports/constants';
import {
  getProfitLossData,
  getPurchaseReport,
  getSalaryBreakdown,
  exportFinancialReportCSV,
} from '@/lib/reports/actions';

interface SalaryRecordRow {
  id: string;
  salaryNumber: string;
  employeeName: string;
  branchName: string;
  periodStart: string;
  periodEnd: string;
  baseSalary: number;
  bonusAmount: number;
  incentiveAmount: number;
  grossAmount: number;
  status: string;
}

interface ProfitLossClientProps {
  initialPL: ProfitLossStatement;
  initialPurchases: PurchaseReportRow[];
  initialSalaries: SalaryRecordRow[];
  branches: Array<{ id: string; name: string; code: string }>;
  isBranchRestricted: boolean;
  selectedBranchId?: string;
  initialDateRange: ReportDateRange;
  initialPreset?: DateRangePreset;
}

export function ProfitLossClient({
  initialPL,
  initialPurchases,
  initialSalaries,
  branches,
  isBranchRestricted,
  selectedBranchId = 'all',
  initialDateRange,
  initialPreset = 'month',
}: ProfitLossClientProps) {
  const [isPending, startTransition] = useTransition();
  const [dateRange, setDateRange] = useState<ReportDateRange>(initialDateRange);
  const [preset, setPreset] = useState<DateRangePreset>(initialPreset);
  const [branchId, setBranchId] = useState<string>(selectedBranchId);

  const [pl, setPL] = useState<ProfitLossStatement>(initialPL);
  const [purchases, setPurchases] = useState<PurchaseReportRow[]>(initialPurchases);
  const [salaries, setSalaries] = useState<SalaryRecordRow[]>(initialSalaries);
  const [exportLoading, setExportLoading] = useState(false);

  const reloadData = (newBranch: string, newRange: ReportDateRange) => {
    startTransition(async () => {
      const bId = newBranch === 'all' ? undefined : newBranch;
      const [plRes, purRes, salRes] = await Promise.all([
        getProfitLossData({ branchId: bId, dateRange: newRange }),
        getPurchaseReport({ branchId: bId, dateRange: newRange }),
        getSalaryBreakdown({ branchId: bId, dateRange: newRange }),
      ]);

      if (plRes.success) setPL(plRes.data);
      if (purRes.success) setPurchases(purRes.data);
      if (salRes.success) setSalaries(salRes.data);
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
      const res = await exportFinancialReportCSV({
        branchId: branchId === 'all' ? undefined : branchId,
        dateRange,
      });
      if (res.success && res.data) {
        const filename = `profit-loss-statement-${dateRange.startDate}-to-${dateRange.endDate}.csv`;
        downloadCSV(res.data, filename);
      }
    } catch (err) {
      console.error('Failed to export P&L CSV', err);
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
            Profit & Loss Statement
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Operational financial performance tracking revenue deductions, approved expenses, and payroll.
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

      {/* ─── Disclaimer Alert ─────────────────────────────────────────────── */}
      <Alert className="border-border/60 bg-muted/30">
        <AlertCircle className="w-4 h-4 text-primary" />
        <AlertTitle className="text-xs font-semibold">
          Operational Management Report
        </AlertTitle>
        <AlertDescription className="text-xs text-muted-foreground">
          This report reflects operational inflows (settled orders minus refunds) and outflows (approved expenses and payroll). It is designed for internal management decision-making, not statutory tax accounting. Inventory purchases are tracked independently.
        </AlertDescription>
      </Alert>

      {/* ─── Summary Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportCard
          title="Net Revenue"
          value={formatCurrency(pl.netRevenue)}
          subtitle={`Gross: ${formatCurrency(pl.grossSales)}`}
          icon={<DollarSign className="w-4 h-4" />}
          variant="primary"
          loading={isPending}
        />

        <ReportCard
          title="Operating Expenses"
          value={formatCurrency(pl.approvedExpenses)}
          subtitle={`${pl.expenseCategories.length} active categories`}
          icon={<Building2 className="w-4 h-4" />}
          variant="warning"
          loading={isPending}
        />

        <ReportCard
          title="Payroll / Salaries"
          value={formatCurrency(pl.approvedSalary)}
          subtitle={`${salaries.length} employee payroll records`}
          icon={<Users className="w-4 h-4" />}
          variant="info"
          loading={isPending}
        />

        <ReportCard
          title="Operating Result"
          value={formatCurrency(pl.operatingResult)}
          subtitle={`Total Costs: ${formatCurrency(pl.totalCosts)}`}
          icon={
            pl.operatingResult >= 0 ? (
              <ArrowUpRight className="w-4 h-4" />
            ) : (
              <ArrowDownRight className="w-4 h-4" />
            )
          }
          variant={pl.operatingResult >= 0 ? 'success' : 'danger'}
          loading={isPending}
        />
      </div>

      {/* ─── Detailed Tabs ────────────────────────────────────────────────── */}
      <Tabs defaultValue="statement" className="space-y-4">
        <TabsList className="bg-card/70 border border-border/60 p-1 rounded-xl">
          <TabsTrigger value="statement" className="text-xs rounded-lg gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5" /> P&L Statement
          </TabsTrigger>
          <TabsTrigger value="expenses" className="text-xs rounded-lg gap-1.5">
            <Building2 className="w-3.5 h-3.5" /> Operating Expenses
          </TabsTrigger>
          <TabsTrigger value="salaries" className="text-xs rounded-lg gap-1.5">
            <Users className="w-3.5 h-3.5" /> Payroll Detail
          </TabsTrigger>
          <TabsTrigger value="purchases" className="text-xs rounded-lg gap-1.5">
            <ShoppingBag className="w-3.5 h-3.5" /> Purchases (Separate)
          </TabsTrigger>
        </TabsList>

        {/* ─── Hierarchical P&L Statement Tab ─────────────────────────────── */}
        <TabsContent value="statement" className="space-y-4">
          <ReportTableWrapper
            title="Operational Statement of Revenue & Costs"
            description={`Reporting period: ${pl.dateRange.startDate} to ${pl.dateRange.endDate}${
              pl.branchName ? ` • Branch: ${pl.branchName}` : ' • All Branches'
            }`}
            onExportCSV={handleExportCSV}
            exportLoading={exportLoading}
            loading={isPending}
          >
            <div className="p-4 md:p-6 space-y-6">
              {/* Section 1: Revenue */}
              <div className="space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    I. Revenue & Collections
                  </h3>
                  <span className="text-xs font-semibold text-muted-foreground">Amount (INR)</span>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between py-1.5 px-2 hover:bg-muted/30 rounded-lg">
                    <span className="font-medium text-foreground">Gross Completed Sales</span>
                    <span className="font-semibold">{formatCurrency(pl.grossSales)}</span>
                  </div>

                  <div className="flex items-center justify-between py-1.5 px-2 text-muted-foreground hover:bg-muted/30 rounded-lg">
                    <span className="pl-4">(−) Promotional Discounts</span>
                    <span className="text-rose-600 dark:text-rose-400">
                      {pl.discounts > 0 ? `-${formatCurrency(pl.discounts)}` : '₹0.00'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1.5 px-2 text-muted-foreground hover:bg-muted/30 rounded-lg">
                    <span className="pl-4">(−) Customer Refunds</span>
                    <span className="text-amber-600 dark:text-amber-400">
                      {pl.refunds > 0 ? `-${formatCurrency(pl.refunds)}` : '₹0.00'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1.5 px-2 text-muted-foreground hover:bg-muted/30 rounded-lg">
                    <span className="pl-4">(+) Tax Collected</span>
                    <span>{formatCurrency(pl.taxCollected)}</span>
                  </div>

                  <div className="flex items-center justify-between py-1.5 px-2 text-muted-foreground hover:bg-muted/30 rounded-lg">
                    <span className="pl-4">(+) Delivery Charges</span>
                    <span>{formatCurrency(pl.deliveryCharges)}</span>
                  </div>

                  <div className="flex items-center justify-between py-2 px-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    <span>Net Operating Revenue</span>
                    <span>{formatCurrency(pl.netRevenue)}</span>
                  </div>
                </div>
              </div>

              {/* Section 2: Operating Costs */}
              <div className="space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    II. Operating Costs & Expenses
                  </h3>
                  <span className="text-xs font-semibold text-muted-foreground">Amount (INR)</span>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between py-1.5 px-2 hover:bg-muted/30 rounded-lg">
                    <span className="font-medium text-foreground">
                      Approved Operating Expenses
                    </span>
                    <span className="font-semibold">{formatCurrency(pl.approvedExpenses)}</span>
                  </div>

                  {pl.expenseCategories.map((c) => (
                    <div
                      key={c.categoryName}
                      className="flex items-center justify-between py-1 px-2 text-muted-foreground hover:bg-muted/30 rounded-lg text-[11px]"
                    >
                      <span className="pl-6">• {c.categoryName}</span>
                      <span>{formatCurrency(c.amount)}</span>
                    </div>
                  ))}

                  <div className="flex items-center justify-between py-1.5 px-2 hover:bg-muted/30 rounded-lg">
                    <span className="font-medium text-foreground">Approved Salary & Payroll</span>
                    <span className="font-semibold">{formatCurrency(pl.approvedSalary)}</span>
                  </div>

                  <div className="flex items-center justify-between py-2 px-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 mt-1">
                    <span>Total Operating Costs</span>
                    <span>{formatCurrency(pl.totalCosts)}</span>
                  </div>
                </div>
              </div>

              {/* Section 3: Operating Result */}
              <div className="p-4 bg-muted/40 border border-border/60 rounded-2xl">
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <div className="font-bold text-foreground">Operating Result</div>
                    <div className="text-[11px] text-muted-foreground">
                      Net Revenue − Total Operating Costs
                    </div>
                  </div>
                  <div
                    className={`text-xl font-extrabold ${
                      pl.operatingResult >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {formatCurrency(pl.operatingResult)}
                  </div>
                </div>
              </div>
            </div>
          </ReportTableWrapper>
        </TabsContent>

        {/* ─── Operating Expenses Detail Tab ──────────────────────────────── */}
        <TabsContent value="expenses" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ReportTableWrapper
              title="Expense Distribution"
              description="Breakdown of approved operating expenses by category."
            >
              <div className="p-4">
                <DistributionDonutChart
                  data={pl.expenseCategories.map((c) => ({
                    name: c.categoryName,
                    value: c.amount,
                  }))}
                  height={260}
                  valueFormatter={(v) => formatCurrency(v)}
                />
              </div>
            </ReportTableWrapper>

            <ReportTableWrapper
              title="Category Summary"
              description="Approved expenditures per category."
              empty={pl.expenseCategories.length === 0}
            >
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="text-xs font-semibold">Category</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Amount</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pl.expenseCategories.map((c) => {
                      const share =
                        pl.approvedExpenses > 0
                          ? (c.amount / pl.approvedExpenses) * 100
                          : 0;
                      return (
                        <TableRow key={c.categoryName} className="hover:bg-muted/30">
                          <TableCell className="text-xs font-medium">{c.categoryName}</TableCell>
                          <TableCell className="text-xs text-right font-bold text-foreground">
                            {formatCurrency(c.amount)}
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            <Badge variant="secondary" className="text-[10px] h-5">
                              {formatPercent(share)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </ReportTableWrapper>
          </div>
        </TabsContent>

        {/* ─── Salary / Payroll Detail Tab ────────────────────────────────── */}
        <TabsContent value="salaries" className="space-y-4">
          <ReportTableWrapper
            title="Payroll Records Included"
            description="Approved and paid salary records whose compensation period intersects with the selected date range."
            empty={salaries.length === 0}
            emptyMessage="No approved salary records found for this period."
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="text-xs font-semibold">Salary Ref</TableHead>
                    <TableHead className="text-xs font-semibold">Employee</TableHead>
                    <TableHead className="text-xs font-semibold">Branch</TableHead>
                    <TableHead className="text-xs font-semibold">Period</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Base</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Bonus/Incentive</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Gross Amount</TableHead>
                    <TableHead className="text-xs font-semibold text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salaries.map((s) => (
                    <TableRow key={s.id} className="hover:bg-muted/30">
                      <TableCell className="text-xs font-mono font-medium">
                        {s.salaryNumber}
                      </TableCell>
                      <TableCell className="text-xs font-medium">{s.employeeName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{s.branchName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {s.periodStart} to {s.periodEnd}
                      </TableCell>
                      <TableCell className="text-xs text-right font-medium">
                        {formatCurrency(s.baseSalary)}
                      </TableCell>
                      <TableCell className="text-xs text-right text-muted-foreground">
                        {formatCurrency(s.bonusAmount + s.incentiveAmount)}
                      </TableCell>
                      <TableCell className="text-xs text-right font-bold text-foreground">
                        {formatCurrency(s.grossAmount)}
                      </TableCell>
                      <TableCell className="text-xs text-center">
                        <Badge
                          variant={s.status === 'PAID' ? 'default' : 'secondary'}
                          className="text-[10px] h-5"
                        >
                          {s.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ReportTableWrapper>
        </TabsContent>

        {/* ─── Inventory Purchases Tab ────────────────────────────────────── */}
        <TabsContent value="purchases" className="space-y-4">
          <ReportTableWrapper
            title="Inventory Purchases (Tracked Separately)"
            description="Procurement orders placed during this period. Tracked separately from operating expenses per restaurant accounting practice."
            empty={purchases.length === 0}
            emptyMessage="No purchase orders recorded for this period."
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="text-xs font-semibold">PO Number</TableHead>
                    <TableHead className="text-xs font-semibold">Supplier</TableHead>
                    <TableHead className="text-xs font-semibold">Branch</TableHead>
                    <TableHead className="text-xs font-semibold">Order Date</TableHead>
                    <TableHead className="text-xs font-semibold text-center">Status</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Ordered Total</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Received Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map((p) => (
                    <TableRow key={p.purchaseOrderId} className="hover:bg-muted/30">
                      <TableCell className="text-xs font-mono font-medium">
                        {p.purchaseNumber}
                      </TableCell>
                      <TableCell className="text-xs font-medium">{p.supplierName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.branchName} ({p.branchCode})
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.orderDate}</TableCell>
                      <TableCell className="text-xs text-center">
                        <Badge variant="outline" className="text-[10px] h-5">
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-right font-medium">
                        {formatCurrency(p.totalAmount)}
                      </TableCell>
                      <TableCell className="text-xs text-right font-bold text-foreground">
                        {formatCurrency(p.receivedAmount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ReportTableWrapper>
        </TabsContent>
      </Tabs>
    </div>
  );
}
