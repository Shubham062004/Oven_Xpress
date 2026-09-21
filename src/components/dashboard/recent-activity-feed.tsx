'use client';

import React from 'react';
import Link from 'next/link';
import {
  Clock,
  CheckCircle2,
  CreditCard,
  Package,
  AlertTriangle,
  FileCheck,
  Star,
  MessageSquare,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { RecentActivityItem, RecentActivityType } from '@/lib/reports/dashboard-types';

interface RecentActivityFeedProps {
  activities: RecentActivityItem[];
  isPending?: boolean;
}

function getActivityIcon(type: RecentActivityType) {
  switch (type) {
    case 'ORDER_COMPLETED':
      return { icon: CheckCircle2, color: 'text-emerald-500 bg-emerald-500/10' };
    case 'PAYMENT_RECEIVED':
      return { icon: CreditCard, color: 'text-blue-500 bg-blue-500/10' };
    case 'PURCHASE_RECEIVED':
      return { icon: Package, color: 'text-indigo-500 bg-indigo-500/10' };
    case 'WASTAGE_RECORDED':
    case 'STOCK_ADJUSTED':
      return { icon: AlertTriangle, color: 'text-amber-500 bg-amber-500/10' };
    case 'EXPENSE_APPROVED':
      return { icon: FileCheck, color: 'text-violet-500 bg-violet-500/10' };
    case 'REVIEW_SUBMITTED':
      return { icon: Star, color: 'text-yellow-500 bg-yellow-500/10' };
    case 'CUSTOMER_ISSUE':
      return { icon: MessageSquare, color: 'text-rose-500 bg-rose-500/10' };
    default:
      return { icon: Clock, color: 'text-muted-foreground bg-muted/40' };
  }
}

export function RecentActivityFeed({ activities, isPending }: RecentActivityFeedProps) {
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <Card className="border border-border/60 shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <CardTitle className="text-base font-semibold text-foreground">
            Live Activity Stream
          </CardTitle>
        </div>
        <Badge variant="outline" className="text-xs">
          Recent Events
        </Badge>
      </CardHeader>

      <CardContent>
        {activities.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No recent operational events recorded.
          </div>
        ) : (
          <div className={`space-y-2.5 ${isPending ? 'opacity-50' : ''}`}>
            {activities.map((act) => {
              const { icon: Icon, color } = getActivityIcon(act.type);
              const ContentWrapper = act.link ? Link : 'div';

              return (
                <ContentWrapper
                  key={act.id}
                  href={act.link || '#'}
                  className={`flex items-start justify-between p-3 rounded-xl border border-border/40 hover:bg-muted/30 transition-colors text-xs ${
                    act.link ? 'cursor-pointer' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-semibold text-foreground">{act.title}</div>
                      <div className="text-muted-foreground text-[11px] mt-0.5">
                        {act.description}
                      </div>
                      {act.branchName && (
                        <div className="text-[10px] text-primary/80 font-medium mt-1">
                          📍 {act.branchName}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-3">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {formatTime(act.timestamp)}
                    </span>
                  </div>
                </ContentWrapper>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
