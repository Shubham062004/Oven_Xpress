'use client';

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import {
  Bell,
  Check,
  CheckCheck,
  ExternalLink,
  Package,
  Receipt,
  CreditCard,
  Banknote,
  Info,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  getRecentNotificationsAction,
  markNotificationAsReadAction,
  markAllNotificationsAsReadAction,
} from '@/lib/notifications/actions';
import type { NotificationItem, NotificationSeverity } from '@/lib/notifications/types';

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
      return <Info className="w-3.5 h-3.5" />;
  }
}

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isPending, startTransition] = useTransition();

  const loadNotifications = async () => {
    try {
      const res = await getRecentNotificationsAction(5);
      if (res.success && res.data) {
        setNotifications(res.data.notifications);
        setUnreadCount(res.data.unreadCount);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchRecent = async () => {
      try {
        const res = await getRecentNotificationsAction(5);
        if (isMounted && res.success && res.data) {
          setNotifications(res.data.notifications);
          setUnreadCount(res.data.unreadCount);
        }
      } catch (err) {
        console.error('Failed to load notifications:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchRecent();
    const interval = setInterval(fetchRecent, 60000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      loadNotifications();
    }
  };

  const handleMarkAsRead = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();

    startTransition(async () => {
      const res = await markNotificationAsReadAction(id);
      if (res.success) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    });
  };

  const handleMarkAllAsRead = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    startTransition(async () => {
      const res = await markAllNotificationsAsReadAction();
      if (res.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    });
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label="Open notifications"
          />
        }
      >
        <Bell className="size-4 text-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-sm ring-1 ring-background">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-80 sm:w-96 p-0 rounded-2xl shadow-xl border border-border/80 bg-popover/95 backdrop-blur-md overflow-hidden z-50"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-muted/30">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px] font-semibold h-4 px-1.5 bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                {unreadCount} unread
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              disabled={isPending}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors disabled:opacity-50"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </button>
          )}
        </div>

        {/* List of items */}
        <div className="max-h-95 overflow-y-auto divide-y divide-border/30">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Loading alerts...
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-10 text-center space-y-1.5">
              <Bell className="w-8 h-8 mx-auto text-muted-foreground/40" />
              <p className="text-xs font-medium text-muted-foreground">
                No notifications right now
              </p>
              <p className="text-[11px] text-muted-foreground/70">
                You&apos;re completely up to date.
              </p>
            </div>
          ) : (
            notifications.map((item) => {
              const isItemUnread = !item.isRead;
              return (
                <div
                  key={item.id}
                  className={`p-3.5 transition-colors hover:bg-muted/40 relative group ${
                    isItemUnread ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Severity / Type icon indicator */}
                    <div
                      className={`size-7 shrink-0 rounded-lg flex items-center justify-center border ${getSeverityBadge(
                        item.severity
                      )}`}
                    >
                      {getTypeIcon(item.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <Link
                          href={item.actionUrl || '/notifications'}
                          onClick={() => setIsOpen(false)}
                          className="text-xs font-semibold text-foreground truncate hover:underline hover:text-primary flex items-center gap-1"
                        >
                          {item.title}
                          {item.actionUrl && (
                            <ExternalLink className="w-2.5 h-2.5 opacity-50 shrink-0" />
                          )}
                        </Link>
                        <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </div>

                      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {item.message}
                      </p>

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1.5">
                          {item.branchName && (
                            <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/50">
                              {item.branchName}
                            </span>
                          )}
                          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60">
                            {item.severity}
                          </span>
                        </div>

                        {isItemUnread && (
                          <button
                            onClick={(e) => handleMarkAsRead(e, item.id)}
                            disabled={isPending}
                            title="Mark as read"
                            className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Check className="w-3 h-3" />
                            Read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-2.5 border-t border-border/40 bg-muted/20 text-center">
          <Link
            href="/notifications"
            onClick={() => setIsOpen(false)}
            className="text-xs font-medium text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1"
          >
            View all notifications →
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
