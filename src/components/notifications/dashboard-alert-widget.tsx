'use client';

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Package,
  Receipt,
  CreditCard,
  Banknote,
  RotateCw,
  CheckCircle2,
  Bell,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  getNotificationsAction,
  evaluateAlertsAction,
} from '@/lib/notifications/actions';
import type { NotificationItem } from '@/lib/notifications/types';

interface DashboardAlertWidgetProps {
  branchId?: string;
  initialNotifications?: NotificationItem[];
  initialStats?: {
    critical: number;
    warning: number;
    unread: number;
  };
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays}d ago`;
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'OUT_OF_STOCK':
    case 'LOW_STOCK':
    case 'STOCK_VARIANCE':
      return <Package className="w-3.5 h-3.5" />;
    case 'PENDING_EXPENSE_APPROVAL':
      return <Receipt className="w-3.5 h-3.5" />;
    case 'PENDING_BONUS_APPROVAL':
    case 'PENDING_SALARY_REVIEW':
      return <Banknote className="w-3.5 h-3.5" />;
    case 'FAILED_PAYMENT':
    case 'UNPAID_ORDER':
      return <CreditCard className="w-3.5 h-3.5" />;
    case 'ATTENDANCE_ALERT':
      return <Calendar className="w-3.5 h-3.5" />;
    default:
      return <Bell className="w-3.5 h-3.5" />;
  }
}

export function DashboardAlertWidget({
  branchId,
  initialNotifications,
  initialStats,
}: DashboardAlertWidgetProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(
    initialNotifications ?? []
  );
  const [stats, setStats] = useState(
    initialStats ?? {
      critical: 0,
      warning: 0,
      unread: 0,
    }
  );
  const [isLoading, setIsLoading] = useState<boolean>(!initialNotifications);
  const [isPending, startTransition] = useTransition();

  // Avoid duplicate initial fetch if server or parent component preloaded the alerts
  const isFirstMountRef = React.useRef(true);
  const initialBranchRef = React.useRef(branchId);

  const loadAlerts = async (bId?: string) => {
    try {
      const effectiveBranch = bId === 'all' ? undefined : bId;
      const res = await getNotificationsAction({
        branchId: effectiveBranch,
        isDismissed: false,
        limit: 5,
        page: 1,
      });

      if (res.success && res.data) {
        setNotifications(res.data.notifications);
        setStats({
          critical: res.data.stats.critical,
          warning: res.data.stats.warning,
          unread: res.data.stats.unread,
        });
      }
    } catch (err) {
      console.error('Failed to load dashboard alerts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // If we were initialized with initialNotifications and branch haven't changed, skip mount fetch
    if (
      isFirstMountRef.current &&
      initialNotifications &&
      initialBranchRef.current === branchId
    ) {
      isFirstMountRef.current = false;
      return;
    }
    isFirstMountRef.current = false;

    let isMounted = true;
    const fetch = async () => {
      try {
        const effectiveBranch = branchId === 'all' ? undefined : branchId;
        const res = await getNotificationsAction({
          branchId: effectiveBranch,
          isDismissed: false,
          limit: 5,
          page: 1,
        });
        if (isMounted && res.success && res.data) {
          setNotifications(res.data.notifications);
          setStats({
            critical: res.data.stats.critical,
            warning: res.data.stats.warning,
            unread: res.data.stats.unread,
          });
        }
      } catch (err) {
        console.error('Failed to load dashboard alerts:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetch();
    return () => {
      isMounted = false;
    };
  }, [branchId, initialNotifications]);

  const handleRefreshAlerts = () => {
    startTransition(async () => {
      const effectiveBranch = branchId === 'all' ? undefined : branchId;
      await evaluateAlertsAction(effectiveBranch);
      await loadAlerts(branchId);
    });
  };

  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  // On mobile screens, display top 2 critical/warning items by default unless expanded
  const displayNotifications = notifications;

  return (
    <Card className="rounded-2xl border border-border/80 shadow-xs overflow-hidden min-w-0 w-full">
      <CardHeader className="p-3 sm:p-4 border-b border-border/40 bg-muted/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <AlertTriangle className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-sm sm:text-base font-semibold text-foreground truncate">
                Alerts & Notifications
              </CardTitle>
              {/* Badges visible on mobile too */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {stats.critical > 0 && (
                  <Badge variant="secondary" className="text-[10px] sm:text-xs py-0 px-1.5 bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">
                    {stats.critical} Critical
                  </Badge>
                )}
                {stats.warning > 0 && (
                  <Badge variant="secondary" className="text-[10px] sm:text-xs py-0 px-1.5 bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                    {stats.warning} Warning
                  </Badge>
                )}
                {stats.unread > 0 && (
                  <Badge variant="outline" className="text-[10px] sm:text-xs py-0 px-1.5">
                    {stats.unread} Unread
                  </Badge>
                )}
              </div>
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
              Real-time operational alerts requiring attention
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefreshAlerts}
            disabled={isPending || isLoading}
            aria-label="Evaluate and refresh alerts"
            className="size-8"
          >
            <RotateCw className={`size-3.5 ${isPending ? 'animate-spin' : ''}`} />
          </Button>

          <Link
            href="/notifications"
            className={buttonVariants({
              variant: 'ghost',
              size: 'sm',
              className: 'h-8 px-2.5 text-xs gap-1 font-medium',
            })}
          >
            <span>View All</span>
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Checking operational status...
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-6 px-4 flex items-center justify-center gap-3 text-center">
            <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className="text-left">
              <p className="text-xs font-semibold text-foreground">
                All systems operating normally
              </p>
              <p className="text-[11px] text-muted-foreground">
                No active operational alerts or pending approval bottlenecks.
              </p>
            </div>
          </div>
        ) : (
          <div>
            <div className="divide-y divide-border/30">
              {displayNotifications.map((item, index) => {
                const isCritical = item.severity === 'CRITICAL';
                const isWarning = item.severity === 'WARNING';
                const badgeClass = isCritical
                  ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30'
                  : isWarning
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
                  : 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30';

                // On mobile, hide items beyond index 1 unless expanded
                const hideOnMobile = !isMobileExpanded && index >= 2;

                return (
                  <div
                    key={item.id}
                    className={`p-3 sm:p-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors hover:bg-muted/30 ${
                      !item.isRead ? 'bg-primary/5' : ''
                    } ${hideOnMobile ? 'hidden sm:flex' : 'flex'}`}
                  >
                    <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
                      <div
                        className={`size-6 sm:size-7 shrink-0 rounded-lg flex items-center justify-center border mt-0.5 ${badgeClass}`}
                      >
                        {getTypeIcon(item.type)}
                      </div>

                      <div className="min-w-0 space-y-0.5 flex-1">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-foreground truncate max-w-full">
                            {item.title}
                          </span>
                          <Badge
                            variant="secondary"
                            className={`text-[9px] sm:text-[10px] uppercase font-bold tracking-wider h-4 px-1 border ${badgeClass}`}
                          >
                            {item.severity}
                          </Badge>
                          {item.branchName && (
                            <span className="text-[9px] sm:text-[10px] text-muted-foreground bg-muted px-1.5 py-0.2 rounded border border-border/50 truncate max-w-28 sm:max-w-40">
                              {item.branchName}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            • {formatRelativeTime(item.createdAt)}
                          </span>
                        </div>
                        <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-1">
                          {item.message}
                        </p>
                      </div>
                    </div>

                    {item.actionUrl && (
                      <Link
                        href={item.actionUrl}
                        className={buttonVariants({
                          variant: 'outline',
                          size: 'sm',
                          className:
                            'h-6 sm:h-7 px-2 sm:px-2.5 text-[11px] sm:text-xs font-medium gap-1 self-end sm:self-auto shrink-0',
                        })}
                      >
                        <span>Open</span>
                        <ExternalLink className="size-3" />
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Mobile Expand / Collapse Control */}
            {notifications.length > 2 && (
              <div className="sm:hidden p-2 text-center border-t border-border/30 bg-muted/10">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMobileExpanded(!isMobileExpanded)}
                  className="text-xs h-7 text-muted-foreground hover:text-foreground"
                >
                  {isMobileExpanded
                    ? 'Show Fewer Alerts'
                    : `Show ${notifications.length - 2} More Alerts`}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
