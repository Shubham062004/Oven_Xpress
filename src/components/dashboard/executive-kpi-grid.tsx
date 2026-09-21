'use client';

import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  IndianRupee,
  CreditCard,
  Wallet,
  Scale,
  Minus,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { ExecutiveKPIs, KPICardValue } from '@/lib/reports/dashboard-types';

interface ExecutiveKPIGridProps {
  kpis: ExecutiveKPIs;
  canViewFinancials: boolean;
  isPending?: boolean;
}

interface SingleKPICardProps {
  kpi: KPICardValue;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  isPending?: boolean;
  reverseTrendColor?: boolean; // for expenses, higher might be red
}

function SingleKPICard({
  kpi,
  icon: Icon,
  accentColor,
  isPending,
  reverseTrendColor = false,
}: SingleKPICardProps) {
  const hasComparison = kpi.changePercentage !== null && kpi.changePercentage !== undefined;
  const isUp = kpi.trend === 'up';
  const isDown = kpi.trend === 'down';

  // Determine badge styling based on trend and reversal
  let badgeVariant = 'bg-muted/50 text-muted-foreground border-border/40';
  let TrendIcon = Minus;

  if (hasComparison) {
    if (isUp) {
      TrendIcon = TrendingUp;
      badgeVariant = reverseTrendColor
        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    } else if (isDown) {
      TrendIcon = TrendingDown;
      badgeVariant = reverseTrendColor
        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
    }
  }

  return (
    <Card className="relative overflow-hidden border border-border/60 shadow-sm hover:shadow-md transition-all duration-200">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {kpi.label}
          </span>
          <div className={`p-2 rounded-xl ${accentColor}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-3">
          <div className={`text-2xl font-bold tracking-tight ${isPending ? 'opacity-50' : ''}`}>
            {kpi.formattedValue}
          </div>

          <div className="flex items-center gap-2 mt-2">
            {hasComparison ? (
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-md border ${badgeVariant}`}
              >
                <TrendIcon className="w-3 h-3" />
                {kpi.changePercentage! > 0 ? `+${kpi.changePercentage}%` : `${kpi.changePercentage}%`}
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground">vs prev period: N/A</span>
            )}

            {kpi.helperText && (
              <span className="text-[11px] text-muted-foreground truncate" title={kpi.helperText}>
                • {kpi.helperText}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ExecutiveKPIGrid({
  kpis,
  canViewFinancials,
  isPending,
}: ExecutiveKPIGridProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight text-foreground uppercase">
          Executive Summary
        </h2>
        <span className="text-xs text-muted-foreground">
          {canViewFinancials ? 'Operational P&L Perspective' : 'Operational Volume View'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {/* 1. Net Sales (Financial) */}
        {canViewFinancials && (
          <SingleKPICard
            kpi={kpis.netSales}
            icon={IndianRupee}
            accentColor="bg-amber-500/10 text-amber-600 dark:text-amber-400"
            isPending={isPending}
          />
        )}

        {/* 2. Completed Orders (Non-financial) */}
        <SingleKPICard
          kpi={kpis.orderCount}
          icon={ShoppingCart}
          accentColor="bg-blue-500/10 text-blue-600 dark:text-blue-400"
          isPending={isPending}
        />

        {/* 3. Average Order Value (Financial) */}
        {canViewFinancials && (
          <SingleKPICard
            kpi={kpis.averageOrderValue}
            icon={TrendingUp}
            accentColor="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
            isPending={isPending}
          />
        )}

        {/* 4. Successful Payments (Financial) */}
        {canViewFinancials && (
          <SingleKPICard
            kpi={kpis.successfulPayments}
            icon={CreditCard}
            accentColor="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            isPending={isPending}
          />
        )}

        {/* 5. Approved Expenses (Financial) */}
        {canViewFinancials && (
          <SingleKPICard
            kpi={kpis.approvedExpenses}
            icon={Wallet}
            accentColor="bg-rose-500/10 text-rose-600 dark:text-rose-400"
            isPending={isPending}
            reverseTrendColor={true}
          />
        )}

        {/* 6. Operating Result (Financial) */}
        {canViewFinancials && (
          <SingleKPICard
            kpi={kpis.operatingResult}
            icon={Scale}
            accentColor={
              kpis.operatingResult.value >= 0
                ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
            }
            isPending={isPending}
          />
        )}
      </div>
    </div>
  );
}
