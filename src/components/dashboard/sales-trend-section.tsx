'use client';

import React, { useSyncExternalStore } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { SalesTrendPoint } from '@/lib/reports/dashboard-types';
import { formatCurrency, formatNumber } from '@/lib/reports/constants';

interface SalesTrendSectionProps {
  data: SalesTrendPoint[];
  grouping: 'hourly' | 'daily';
  canViewFinancials: boolean;
  isPending?: boolean;
}

const emptySubscribe = () => () => {};
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export function SalesTrendSection({
  data,
  grouping,
  canViewFinancials,
  isPending,
}: SalesTrendSectionProps) {
  const mounted = useMounted();

  const totalSales = data.reduce((acc, d) => acc + d.netSales, 0);
  const totalOrders = data.reduce((acc, d) => acc + d.orderCount, 0);

  if (!mounted) {
    return (
      <Card className="border border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Sales Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-70 w-full animate-pulse bg-muted/20 rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  const hasData = totalOrders > 0;

  return (
    <Card className="border border-border/60 shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold text-foreground">
              Sales & Order Velocity
            </CardTitle>
            <Badge variant="outline" className="text-[10px] uppercase font-mono">
              {grouping === 'hourly' ? 'Hourly View (8 AM - 11 PM)' : 'Daily Trend'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {canViewFinancials
              ? `Total Net Sales: ${formatCurrency(totalSales)} across ${formatNumber(totalOrders)} orders`
              : `Total Volume: ${formatNumber(totalOrders)} orders completed`}
          </p>
        </div>
      </CardHeader>

      <CardContent>
        {!hasData ? (
          <div className="h-70 w-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
            <p className="text-sm font-medium">No sales activity in this period</p>
            <p className="text-xs mt-1">Orders placed will reflect in this trend chart.</p>
          </div>
        ) : (
          <div className={`h-70 w-full ${isPending ? 'opacity-50' : ''}`}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 15, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashboardSalesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="hsl(var(--border) / 0.4)"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="sales"
                  orientation="left"
                  hide={!canViewFinancials}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                />
                <YAxis
                  yAxisId="orders"
                  orientation={canViewFinancials ? 'right' : 'left'}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload as SalesTrendPoint;
                      return (
                        <div className="bg-popover/95 backdrop-blur-sm border border-border shadow-lg rounded-xl p-3 text-xs space-y-1">
                          <div className="font-semibold text-foreground">{item.label}</div>
                          {canViewFinancials && (
                            <div className="text-primary font-bold text-sm">
                              {formatCurrency(item.netSales)}
                            </div>
                          )}
                          <div className="text-muted-foreground">
                            {formatNumber(item.orderCount)} completed orders
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {canViewFinancials && (
                  <Area
                    yAxisId="sales"
                    type="monotone"
                    dataKey="netSales"
                    name="Net Sales"
                    stroke="#f97316"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#dashboardSalesGrad)"
                  />
                )}
                <Bar
                  yAxisId="orders"
                  dataKey="orderCount"
                  name="Orders"
                  fill="#3b82f6"
                  opacity={0.3}
                  radius={[4, 4, 0, 0]}
                  barSize={12}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
