'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  ExternalLink,
  RotateCw,
  Search,
  Package,
  Receipt,
  CreditCard,
  Banknote,
  Info,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getNotificationsAction,
  markNotificationAsReadAction,
  markAllNotificationsAsReadAction,
  dismissNotificationAction,
  evaluateAlertsAction,
} from '@/lib/notifications/actions';
import type {
  NotificationListResponse,
  NotificationType,
  NotificationSeverity,
} from '@/lib/notifications/types';

interface NotificationCenterClientProps {
  initialData: NotificationListResponse;
  branches: Array<{ id: string; name: string; code: string }>;
  canFilterBranches: boolean;
  selectedBranchId?: string;
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

function formatFullDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTypeMeta(type: string): { label: string; icon: React.ReactNode } {
  switch (type) {
    case 'OUT_OF_STOCK':
      return { label: 'Out of Stock', icon: <Package className="w-3.5 h-3.5" /> };
    case 'LOW_STOCK':
      return { label: 'Low Stock', icon: <Package className="w-3.5 h-3.5" /> };
    case 'STOCK_VARIANCE':
      return { label: 'Stock Variance', icon: <Package className="w-3.5 h-3.5" /> };
    case 'HIGH_WASTAGE':
      return { label: 'High Wastage', icon: <Package className="w-3.5 h-3.5" /> };
    case 'PENDING_EXPENSE_APPROVAL':
      return { label: 'Expense Approval', icon: <Receipt className="w-3.5 h-3.5" /> };
    case 'PENDING_BONUS_APPROVAL':
      return { label: 'Bonus Approval', icon: <Banknote className="w-3.5 h-3.5" /> };
    case 'PENDING_SALARY_REVIEW':
      return { label: 'Salary Review', icon: <Banknote className="w-3.5 h-3.5" /> };
    case 'FAILED_PAYMENT':
      return { label: 'Failed Payment', icon: <CreditCard className="w-3.5 h-3.5" /> };
    case 'UNPAID_ORDER':
      return { label: 'Unpaid Order', icon: <CreditCard className="w-3.5 h-3.5" /> };
    case 'ATTENDANCE_ALERT':
      return { label: 'Attendance Alert', icon: <Calendar className="w-3.5 h-3.5" /> };
    default:
      return { label: 'Operational Alert', icon: <Info className="w-3.5 h-3.5" /> };
  }
}

function getSeverityBadge(severity: NotificationSeverity) {
  switch (severity) {
    case 'CRITICAL':
      return 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30';
    case 'WARNING':
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30';
    default:
      return 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30';
  }
}

export function NotificationCenterClient({
  initialData,
  branches,
  canFilterBranches,
  selectedBranchId,
}: NotificationCenterClientProps) {
  const [data, setData] = useState<NotificationListResponse>(initialData);
  const [isPending, startTransition] = useTransition();

  // Filter States
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'read' | 'dismissed'>('all');
  const [severityFilter, setSeverityFilter] = useState<NotificationSeverity | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<NotificationType | 'ALL'>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>(selectedBranchId || 'all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  const fetchFilteredData = (overrideParams?: {
    tab?: 'all' | 'unread' | 'read' | 'dismissed';
    severity?: NotificationSeverity | 'ALL';
    type?: NotificationType | 'ALL';
    branchId?: string;
    search?: string;
    page?: number;
  }) => {
    startTransition(async () => {
      const tab = overrideParams?.tab ?? activeTab;
      const sev = overrideParams?.severity ?? severityFilter;
      const typ = overrideParams?.type ?? typeFilter;
      const br = overrideParams?.branchId ?? branchFilter;
      const srch = overrideParams?.search ?? searchQuery;
      const pg = overrideParams?.page ?? page;

      let isRead: boolean | undefined = undefined;
      let isDismissed: boolean | undefined = false;

      if (tab === 'unread') {
        isRead = false;
        isDismissed = false;
      } else if (tab === 'read') {
        isRead = true;
        isDismissed = false;
      } else if (tab === 'dismissed') {
        isDismissed = true;
      }

      const res = await getNotificationsAction({
        type: typ,
        severity: sev,
        branchId: br === 'all' ? undefined : br,
        search: srch || undefined,
        isRead,
        isDismissed,
        page: pg,
        limit: 20,
      });

      if (res.success && res.data) {
        setData(res.data);
      }
    });
  };

  const handleTabChange = (tab: 'all' | 'unread' | 'read' | 'dismissed') => {
    setActiveTab(tab);
    setPage(1);
    fetchFilteredData({ tab, page: 1 });
  };

  const handleSeverityChange = (sev: string | null) => {
    if (!sev) return;
    const s = sev as NotificationSeverity | 'ALL';
    setSeverityFilter(s);
    setPage(1);
    fetchFilteredData({ severity: s, page: 1 });
  };

  const handleTypeChange = (typ: string | null) => {
    if (!typ) return;
    const t = typ as NotificationType | 'ALL';
    setTypeFilter(t);
    setPage(1);
    fetchFilteredData({ type: t, page: 1 });
  };

  const handleBranchChange = (br: string | null) => {
    if (!br) return;
    setBranchFilter(br);
    setPage(1);
    fetchFilteredData({ branchId: br, page: 1 });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchFilteredData({ page: 1 });
  };

  const handleMarkAsRead = (id: string) => {
    startTransition(async () => {
      const res = await markNotificationAsReadAction(id);
      if (res.success) {
        setData((prev) => ({
          ...prev,
          notifications: prev.notifications.map((n) =>
            n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
          ),
          stats: {
            ...prev.stats,
            unread: Math.max(0, prev.stats.unread - 1),
          },
        }));
      }
    });
  };

  const handleMarkAllAsRead = () => {
    startTransition(async () => {
      const effectiveBranch = branchFilter === 'all' ? undefined : branchFilter;
      const res = await markAllNotificationsAsReadAction(effectiveBranch);
      if (res.success) {
        setData((prev) => ({
          ...prev,
          notifications: prev.notifications.map((n) => ({ ...n, isRead: true })),
          stats: {
            ...prev.stats,
            unread: 0,
          },
        }));
      }
    });
  };

  const handleDismiss = (id: string) => {
    startTransition(async () => {
      const res = await dismissNotificationAction(id);
      if (res.success) {
        setData((prev) => ({
          ...prev,
          notifications: prev.notifications.filter((n) => n.id !== id),
          stats: {
            ...prev.stats,
            total: Math.max(0, prev.stats.total - 1),
          },
        }));
      }
    });
  };

  const handleEvaluateAlerts = () => {
    startTransition(async () => {
      const effectiveBranch = branchFilter === 'all' ? undefined : branchFilter;
      await evaluateAlertsAction(effectiveBranch);
      fetchFilteredData();
    });
  };

  return (
    <div className="space-y-6">
      {/* ─── Header & Top Actions ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Notification Center
            </h1>
            <Badge variant="outline" className="text-xs">
              {data.pagination.total} alerts
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time operational alerts, stock thresholds, approvals, and payment updates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleEvaluateAlerts}
            disabled={isPending}
            className="h-9 gap-1.5 text-xs font-medium"
          >
            <RotateCw className={`size-3.5 ${isPending ? 'animate-spin' : ''}`} />
            Run Alert Check
          </Button>

          {data.stats.unread > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={isPending}
              className="h-9 gap-1.5 text-xs font-medium"
            >
              <CheckCheck className="size-3.5" />
              Mark All Read
            </Button>
          )}
        </div>
      </div>

      {/* ─── Stat Badges / Quick Metrics ─────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl border border-border/80 bg-card shadow-2xs">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Total Notifications
          </p>
          <p className="text-xl font-bold text-foreground mt-1">{data.stats.total}</p>
        </div>

        <div className="p-3.5 rounded-2xl border border-border/80 bg-card shadow-2xs">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Unread
          </p>
          <p className="text-xl font-bold text-primary mt-1">{data.stats.unread}</p>
        </div>

        <div className="p-3.5 rounded-2xl border border-rose-500/20 bg-rose-500/5 shadow-2xs">
          <p className="text-[11px] font-medium text-rose-700 dark:text-rose-400 uppercase tracking-wider">
            Critical
          </p>
          <p className="text-xl font-bold text-rose-700 dark:text-rose-400 mt-1">
            {data.stats.critical}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl border border-amber-500/20 bg-amber-500/5 shadow-2xs">
          <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wider">
            Warnings
          </p>
          <p className="text-xl font-bold text-amber-700 dark:text-amber-400 mt-1">
            {data.stats.warning}
          </p>
        </div>
      </div>

      {/* ─── Tabs & Filters Bar ─────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 border-b border-border/50 pb-2">
          <button
            onClick={() => handleTabChange('all')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'all'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            }`}
          >
            All ({data.stats.total})
          </button>
          <button
            onClick={() => handleTabChange('unread')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'unread'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            }`}
          >
            Unread
            {data.stats.unread > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-600 text-white font-bold">
                {data.stats.unread}
              </span>
            )}
          </button>
          <button
            onClick={() => handleTabChange('read')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'read'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            }`}
          >
            Read
          </button>
          <button
            onClick={() => handleTabChange('dismissed')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'dismissed'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            }`}
          >
            Dismissed History
          </button>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="flex-1 min-w-50 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notifications..."
              className="pl-8.5 h-9 text-xs"
            />
          </form>

          {/* Severity Filter */}
          <Select value={severityFilter} onValueChange={handleSeverityChange}>
            <SelectTrigger className="w-32.5 h-9 text-xs">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Severities</SelectItem>
              <SelectItem value="CRITICAL">Critical</SelectItem>
              <SelectItem value="WARNING">Warning</SelectItem>
              <SelectItem value="INFO">Info</SelectItem>
            </SelectContent>
          </Select>

          {/* Type Filter */}
          <Select value={typeFilter} onValueChange={handleTypeChange}>
            <SelectTrigger className="w-45 h-9 text-xs">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Categories</SelectItem>
              <SelectItem value="OUT_OF_STOCK">Out of Stock</SelectItem>
              <SelectItem value="LOW_STOCK">Low Stock</SelectItem>
              <SelectItem value="STOCK_VARIANCE">Stock Variance</SelectItem>
              <SelectItem value="PENDING_EXPENSE_APPROVAL">Expense Approvals</SelectItem>
              <SelectItem value="PENDING_BONUS_APPROVAL">Bonus Approvals</SelectItem>
              <SelectItem value="PENDING_SALARY_REVIEW">Salary Reviews</SelectItem>
              <SelectItem value="FAILED_PAYMENT">Failed Payments</SelectItem>
              <SelectItem value="UNPAID_ORDER">Unpaid Orders</SelectItem>
              <SelectItem value="ATTENDANCE_ALERT">Attendance</SelectItem>
            </SelectContent>
          </Select>

          {/* Branch Filter */}
          {canFilterBranches && branches.length > 0 && (
            <Select value={branchFilter} onValueChange={handleBranchChange}>
              <SelectTrigger className="w-37.5 h-9 text-xs">
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* ─── Notifications List ─────────────────────────────────────────── */}
      <Card className="rounded-2xl border border-border/80 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          {data.notifications.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <Bell className="size-10 mx-auto text-muted-foreground/30" />
              <p className="text-sm font-semibold text-foreground">
                No notifications found
              </p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                No active operational alerts or messages match your current filters.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {data.notifications.map((item) => {
                const meta = getTypeMeta(item.type);
                const badgeClass = getSeverityBadge(item.severity);

                return (
                  <div
                    key={item.id}
                    className={`p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:bg-muted/30 ${
                      !item.isRead ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      {/* Icon */}
                      <div
                        className={`size-8 shrink-0 rounded-xl flex items-center justify-center border mt-0.5 ${badgeClass}`}
                      >
                        {meta.icon}
                      </div>

                      {/* Content */}
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-foreground">
                            {item.title}
                          </h3>
                          <Badge
                            variant="secondary"
                            className={`text-[10px] uppercase font-bold tracking-wider h-4 px-1.5 border ${badgeClass}`}
                          >
                            {item.severity}
                          </Badge>
                          <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md border border-border/50">
                            {meta.label}
                          </span>
                          {item.branchName && (
                            <span className="text-[11px] font-medium text-foreground/80 bg-accent px-2 py-0.5 rounded-md">
                              {item.branchName}
                            </span>
                          )}
                          <span
                            className="text-[11px] text-muted-foreground"
                            title={formatFullDate(item.createdAt)}
                          >
                            • {formatRelativeTime(item.createdAt)}
                          </span>
                        </div>

                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {item.message}
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      {item.actionUrl && (
                        <Link
                          href={item.actionUrl}
                          className={buttonVariants({
                            variant: 'outline',
                            size: 'sm',
                            className: 'h-8 px-3 text-xs font-medium gap-1',
                          })}
                        >
                          Open Source <ExternalLink className="size-3 opacity-60" />
                        </Link>
                      )}

                      {!item.isRead && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMarkAsRead(item.id)}
                          disabled={isPending}
                          className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1"
                        >
                          <Check className="size-3.5" />
                          Read
                        </Button>
                      )}

                      {!item.isDismissed && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDismiss(item.id)}
                          disabled={isPending}
                          title="Dismiss notification"
                          className="size-8 text-muted-foreground hover:text-rose-600"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Pagination Controls ────────────────────────────────────────── */}
      {data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-2 pt-2">
          <p className="text-xs text-muted-foreground">
            Showing {(data.pagination.page - 1) * data.pagination.limit + 1} to{' '}
            {Math.min(
              data.pagination.page * data.pagination.limit,
              data.pagination.total
            )}{' '}
            of {data.pagination.total} notifications
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const prev = Math.max(1, page - 1);
                setPage(prev);
                fetchFilteredData({ page: prev });
              }}
              disabled={page <= 1 || isPending}
              className="h-8 px-2.5 text-xs gap-1"
            >
              <ChevronLeft className="size-3.5" /> Previous
            </Button>
            <span className="text-xs font-medium px-2">
              Page {data.pagination.page} of {data.pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const next = Math.min(data.pagination.totalPages, page + 1);
                setPage(next);
                fetchFilteredData({ page: next });
              }}
              disabled={page >= data.pagination.totalPages || isPending}
              className="h-8 px-2.5 text-xs gap-1"
            >
              Next <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
