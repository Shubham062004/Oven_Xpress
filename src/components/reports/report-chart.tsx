'use client';

import React, { useSyncExternalStore } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { formatCurrency, formatHour } from '@/lib/reports/constants';

const emptySubscribe = () => () => {};
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

const PALETTE = [
  '#f97316', // primary / orange
  '#3b82f6', // blue
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#eab308', // amber
  '#06b6d4', // cyan
];

// ─── Revenue Trend Area Chart ───────────────────────────────────────────────

interface RevenueTrendChartProps {
  data: Array<{ date: string; revenue: number; orders?: number }>;
  height?: number;
}

export function RevenueTrendChart({ data, height = 280 }: RevenueTrendChartProps) {
  const mounted = useMounted();

  if (!mounted) {
    return <div style={{ height }} className="w-full animate-pulse bg-muted/20 rounded-xl" />;
  }

  if (data.length === 0) {
    return (
      <div style={{ height }} className="w-full flex items-center justify-center text-xs text-muted-foreground">
        No revenue data in this period
      </div>
    );
  }

  return (
    <div style={{ height, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#f97316" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.4)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(val) => {
              const parts = val.split('-');
              return parts.length === 3 ? `${parts[2]}/${parts[1]}` : val;
            }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload;
                return (
                  <div className="bg-popover/95 backdrop-blur-sm border border-border/80 shadow-lg rounded-xl p-3 text-xs">
                    <div className="font-medium text-foreground mb-1">{label}</div>
                    <div className="text-primary font-bold text-sm">
                      {formatCurrency(Number(item.revenue || 0))}
                    </div>
                    {item.orders !== undefined && (
                      <div className="text-muted-foreground text-[11px] mt-0.5">
                        {item.orders} orders
                      </div>
                    )}
                  </div>
                );
              }
              return null;
            }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#f97316"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#revenueGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Hourly Bar Chart ───────────────────────────────────────────────────────

interface HourlyBarChartProps {
  data: Array<{ hour: number; orderCount: number; sales: number }>;
  height?: number;
}

export function HourlyBarChart({ data, height = 240 }: HourlyBarChartProps) {
  const mounted = useMounted();

  if (!mounted) {
    return <div style={{ height }} className="w-full animate-pulse bg-muted/20 rounded-xl" />;
  }

  // Filter out late-night zero hours to keep chart focused, or show all
  const filteredData = data.filter((d) => d.hour >= 8 && d.hour <= 23);
  const chartData = filteredData.length > 0 ? filteredData : data;

  return (
    <div style={{ height, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.4)" />
          <XAxis
            dataKey="hour"
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(h) => formatHour(Number(h))}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload;
                return (
                  <div className="bg-popover/95 backdrop-blur-sm border border-border/80 shadow-lg rounded-xl p-3 text-xs">
                    <div className="font-medium text-foreground mb-1">{formatHour(item.hour)}</div>
                    <div className="text-foreground font-semibold">
                      {item.orderCount} orders
                    </div>
                    <div className="text-primary font-bold">
                      {formatCurrency(item.sales)}
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="orderCount" fill="#3b82f6" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Distribution Donut Chart ───────────────────────────────────────────────

interface DistributionChartProps {
  data: Array<{ name: string; value: number; secondary?: number }>;
  height?: number;
  valueFormatter?: (val: number) => string;
}

export function DistributionDonutChart({
  data,
  height = 240,
  valueFormatter = (v) => `${v}`,
}: DistributionChartProps) {
  const mounted = useMounted();

  if (!mounted) {
    return <div style={{ height }} className="w-full animate-pulse bg-muted/20 rounded-xl" />;
  }

  const validData = data.filter((d) => d.value > 0);

  if (validData.length === 0) {
    return (
      <div style={{ height }} className="w-full flex items-center justify-center text-xs text-muted-foreground">
        No distribution data
      </div>
    );
  }

  return (
    <div style={{ height, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={validData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
          >
            {validData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload;
                return (
                  <div className="bg-popover/95 backdrop-blur-sm border border-border/80 shadow-lg rounded-xl p-2.5 text-xs">
                    <div className="font-semibold text-foreground">{item.name}</div>
                    <div className="text-primary font-bold mt-0.5">
                      {valueFormatter(item.value)}
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            formatter={(val) => <span className="text-xs text-foreground font-medium">{val}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
