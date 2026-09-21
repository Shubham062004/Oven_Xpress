'use client';

import React, { useState, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DashboardFilterBar } from './dashboard-filter-bar';
import { ExecutiveKPIGrid } from './executive-kpi-grid';
import { SalesTrendSection } from './sales-trend-section';
import { BranchPerformanceSection } from './branch-performance-section';
import { OperationsSummaryGrid } from './operations-summary-grid';
import { RecentActivityFeed } from './recent-activity-feed';
import { DashboardAlertWidget } from '@/components/notifications/dashboard-alert-widget';
import type {
  ExecutiveDashboardData,
  DashboardDatePreset,
} from '@/lib/reports/dashboard-types';
import {
  getExecutiveDashboardData,
  exportDashboardSummaryCSV,
} from '@/lib/reports/dashboard-service';
import { downloadCSV } from '@/lib/reports/constants';

interface OwnerDashboardClientProps {
  initialData: ExecutiveDashboardData;
}

export function OwnerDashboardClient({ initialData }: OwnerDashboardClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState<ExecutiveDashboardData>(initialData);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const updateUrlFilters = (filters: {
    preset: DashboardDatePreset;
    branchId: string;
    from?: string;
    to?: string;
  }) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('preset', filters.preset);
    params.set('branchId', filters.branchId);

    if (filters.preset === 'custom' && filters.from && filters.to) {
      params.set('from', filters.from);
      params.set('to', filters.to);
    } else {
      params.delete('from');
      params.delete('to');
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleFilterChange = (filters: {
    preset: DashboardDatePreset;
    branchId: string;
    from?: string;
    to?: string;
  }) => {
    setErrorMessage(null);
    updateUrlFilters(filters);

    startTransition(async () => {
      const res = await getExecutiveDashboardData({
        branchId: filters.branchId,
        preset: filters.preset,
        from: filters.from,
        to: filters.to,
      });

      if (res.success) {
        setData(res.data);
      } else {
        setErrorMessage(res.error);
      }
    });
  };

  const handleRefresh = () => {
    setErrorMessage(null);
    startTransition(async () => {
      const res = await getExecutiveDashboardData({
        branchId: data.selectedBranchId,
        preset: data.preset,
        from: data.dateRange.startDate,
        to: data.dateRange.endDate,
      });

      if (res.success) {
        setData(res.data);
      } else {
        setErrorMessage(res.error);
      }
    });
  };

  const handleExportCSV = async () => {
    const res = await exportDashboardSummaryCSV({
      branchId: data.selectedBranchId,
      preset: data.preset,
      from: data.dateRange.startDate,
      to: data.dateRange.endDate,
    });

    if (res.success) {
      downloadCSV(
        res.data,
        `oven-xpress-dashboard-${data.preset}-${data.selectedBranchId}-${Date.now()}.csv`
      );
    } else {
      alert(res.error);
    }
  };

  const formattedPeriod = `${data.dateRange.startDate} to ${data.dateRange.endDate}`;

  return (
    <div className="space-y-6">
      {/* ─── Page Hero Banner ──────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Welcome back, {data.userName}
            </h1>
            <Badge variant="outline" className="text-xs uppercase font-mono py-0.5">
              {data.userRole}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
            <span>Central Business Command & Operational State</span>
            <span>•</span>
            <span className="font-medium text-foreground">
              Period: {data.preset === 'today' ? 'Today' : formattedPeriod}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {data.isBranchRestricted && (
            <Badge variant="secondary" className="text-xs py-1 px-2.5">
              Assigned Branch Scope
            </Badge>
          )}
          {!data.isBranchRestricted && (
            <Badge variant="outline" className="text-xs py-1 px-2.5 bg-primary/5 text-primary border-primary/20">
              Cross-Branch Rollup
            </Badge>
          )}
        </div>
      </div>

      {/* Error alert if re-fetching fails */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-center justify-between">
          <span>{errorMessage}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            className="text-xs h-7"
          >
            Retry
          </Button>
        </div>
      )}

      {/* ─── Operational Alerts Banner (Step 16) ───────────────────────────── */}
      <DashboardAlertWidget
        branchId={data.effectiveBranchId}
      />

      {/* ─── Global Filters Bar ────────────────────────────────────────────── */}
      <DashboardFilterBar
        preset={data.preset}
        selectedBranchId={data.selectedBranchId}
        from={data.dateRange.startDate}
        to={data.dateRange.endDate}
        branches={data.accessibleBranches}
        isBranchRestricted={data.isBranchRestricted}
        isPending={isPending}
        onFilterChange={handleFilterChange}
        onRefresh={handleRefresh}
        onExportCSV={handleExportCSV}
      />

      {/* ─── Section 1: Executive KPI Grid ─────────────────────────────────── */}
      <ExecutiveKPIGrid
        kpis={data.kpis}
        canViewFinancials={data.canViewFinancials}
        isPending={isPending}
      />

      {/* ─── Section 2: Sales Velocity & Live Feed ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SalesTrendSection
            data={data.salesTrend}
            grouping={data.salesTrendGrouping}
            canViewFinancials={data.canViewFinancials}
            isPending={isPending}
          />
        </div>
        <div className="lg:col-span-1">
          <RecentActivityFeed
            activities={data.recentActivity}
            isPending={isPending}
          />
        </div>
      </div>

      {/* ─── Section 3: Branch Performance Benchmark ───────────────────────── */}
      {(!data.isBranchRestricted || data.canViewBranches) && (
        <BranchPerformanceSection
          branches={data.branchPerformance}
          canViewFinancials={data.canViewFinancials}
          isPending={isPending}
        />
      )}

      {/* ─── Section 4: Operational Summaries ──────────────────────────────── */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-foreground uppercase">
            Operations & Health Indicators
          </h2>
          <span className="text-xs text-muted-foreground">
            Inventory, Attendance, Orders, Payments & Queue
          </span>
        </div>

        <OperationsSummaryGrid
          orderOverview={data.orderOverview}
          paymentOverview={data.paymentOverview}
          topProducts={data.topProducts}
          inventoryHealth={data.inventoryHealth}
          attendanceOverview={data.attendanceOverview}
          pendingApprovals={data.pendingApprovals}
          customerFeedback={data.customerFeedback}
          canViewFinancials={data.canViewFinancials}
          isPending={isPending}
        />
      </div>
    </div>
  );
}
