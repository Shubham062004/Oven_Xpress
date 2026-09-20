import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface ReportCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
    label?: string;
  };
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  loading?: boolean;
  className?: string;
}

const VARIANT_STYLES = {
  default: {
    border: 'border-border/60',
    iconBg: 'bg-muted/80 text-foreground',
    glow: 'hover:border-border',
  },
  primary: {
    border: 'border-primary/20',
    iconBg: 'bg-primary/10 text-primary',
    glow: 'hover:border-primary/40',
  },
  success: {
    border: 'border-emerald-500/20',
    iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    glow: 'hover:border-emerald-500/40',
  },
  warning: {
    border: 'border-amber-500/20',
    iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    glow: 'hover:border-amber-500/40',
  },
  danger: {
    border: 'border-rose-500/20',
    iconBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    glow: 'hover:border-rose-500/40',
  },
  info: {
    border: 'border-sky-500/20',
    iconBg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    glow: 'hover:border-sky-500/40',
  },
};

export function ReportCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  variant = 'default',
  loading = false,
  className = '',
}: ReportCardProps) {
  const styles = VARIANT_STYLES[variant];

  if (loading) {
    return (
      <Card className={`rounded-2xl border ${styles.border} bg-card/60 backdrop-blur-sm p-5 ${className}`}>
        <CardContent className="p-0 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-9 rounded-xl" />
          </div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-40" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={`relative overflow-hidden rounded-2xl border ${styles.border} bg-card/70 backdrop-blur-md p-5 transition-all duration-200 hover:shadow-md ${styles.glow} ${className}`}
    >
      <CardContent className="p-0">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
            {title}
          </span>
          {icon && (
            <div
              className={`flex items-center justify-center w-9 h-9 rounded-xl ${styles.iconBg} transition-transform group-hover:scale-105 shrink-0`}
            >
              {icon}
            </div>
          )}
        </div>

        <div className="text-2xl font-bold tracking-tight text-foreground">
          {value}
        </div>

        {(subtitle || trend) && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            {trend && (
              <span
                className={`font-semibold px-1.5 py-0.5 rounded-md ${
                  trend.isPositive
                    ? 'text-emerald-600 bg-emerald-500/10 dark:text-emerald-400'
                    : 'text-rose-600 bg-rose-500/10 dark:text-rose-400'
                }`}
              >
                {trend.value}
              </span>
            )}
            {subtitle && <span>{subtitle}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
