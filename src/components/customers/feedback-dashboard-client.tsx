'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Star,
  AlertCircle,
  CheckCircle2,
  Clock,
  Building2,
  TrendingUp,
  Plus,
  Users,
  MessageSquare,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

import type {
  FeedbackDashboardData,
  BranchFeedbackSummary,
  CustomerIssueItem,
} from '@/lib/customers/types';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { useAuth } from '@/providers/auth-provider';
import { hasPermission } from '@/lib/permissions/check';

import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { IssueDialog } from '@/components/customers/issue-dialog';
import { IssueActionDialog } from '@/components/customers/issue-action-dialog';

interface FeedbackDashboardClientProps {
  data: FeedbackDashboardData;
  branchBreakdowns: BranchFeedbackSummary[];
  branches: Array<{ id: string; name: string }>;
  currentBranchId?: string;
}

export function FeedbackDashboardClient({
  data,
  branchBreakdowns,
  branches,
  currentBranchId = '',
}: FeedbackDashboardClientProps) {
  const router = useRouter();
  const authUser = useAuth();
  const [isPending, startTransition] = useTransition();

  const [selectedBranchId, setSelectedBranchId] = useState(currentBranchId);
  const [isIssueDialogOpen, setIsIssueDialogOpen] = useState(false);
  const [activeIssueAction, setActiveIssueAction] = useState<{
    issue: CustomerIssueItem;
    mode: 'STATUS' | 'ASSIGN' | 'RESOLVE';
  } | null>(null);

  const canLogIssue = hasPermission(authUser, PERMISSIONS.ISSUE_CREATE);
  const canResolveIssue = hasPermission(authUser, PERMISSIONS.ISSUE_RESOLVE);
  const canAssignIssue = hasPermission(authUser, PERMISSIONS.ISSUE_ASSIGN);

  const {
    totalReviews,
    averageRating,
    pendingReviews,
    openIssues,
    resolvedIssues,
    ratingDistribution,
    recentReviews,
    activeIssues,
  } = data;

  const handleBranchChange = (branchId: string) => {
    setSelectedBranchId(branchId);
    startTransition(() => {
      const params = new URLSearchParams();
      if (branchId) params.set('branchId', branchId);
      router.push(`/feedback?${params.toString()}`);
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Feedback & Operational Quality"
        description="Comprehensive sentiment, customer ratings distribution, review trends, and incident resolution tracking."
      >
        <div className="flex items-center gap-2">
          {branches.length > 1 && (
            <select
              value={selectedBranchId}
              onChange={(e) => handleBranchChange(e.target.value)}
              disabled={isPending}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">All Permitted Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}

          {canLogIssue && (
            <Button
              size="sm"
              onClick={() => setIsIssueDialogOpen(true)}
              className="gap-1.5"
            >
              <Plus className="size-4" />
              Log Incident
            </Button>
          )}
        </div>
      </PageHeader>

      {/* Navigation Sub-Links */}
      <div className="flex flex-wrap items-center gap-2 border-b pb-3">
        <Link
          href="/customers"
          className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Users className="size-3.5" />
          Customer Directory
        </Link>
        <Link
          href="/reviews"
          className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Star className="size-3.5" />
          Reviews & Moderation
        </Link>
        <Link
          href="/feedback"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm"
        >
          <MessageSquare className="size-3.5" />
          Feedback Dashboard
        </Link>
      </div>

      {/* Primary KPI Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Total Reviews</p>
            <Star className="size-4 text-amber-500 fill-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight">{totalReviews}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Recorded feedback</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Average Rating</p>
            <TrendingUp className="size-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
            ★ {averageRating.toFixed(2)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Out of 5.00 stars</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Pending Reviews</p>
            <Clock className="size-4 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
            {pendingReviews}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Awaiting moderation</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Open Issues</p>
            <ShieldAlert className="size-4 text-rose-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
            {openIssues}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Require operational attention</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Resolved Issues</p>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {resolvedIssues}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Successfully remediated</p>
        </Card>
      </div>

      {/* Middle Grid: Rating Distribution & Recent Feedback Stream */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Star Rating Distribution (1–5 Stars) */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Rating Distribution</span>
              <span className="text-xs font-normal text-muted-foreground">
                {totalReviews} Total
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[5, 4, 3, 2, 1].map((stars) => {
              const item = ratingDistribution.find((d) => d.star === stars);
              const count = item?.count || 0;
              const pct = item?.percentage || 0;

              return (
                <div key={stars} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 font-medium">
                      <span>{stars}</span>
                      <Star className="size-3.5 fill-amber-400 text-amber-500" />
                    </span>
                    <span className="text-muted-foreground">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full transition-all ${
                        stars >= 4
                          ? 'bg-emerald-500'
                          : stars === 3
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}

            <div className="pt-3 border-t mt-4 text-xs text-muted-foreground text-center">
              Evaluations are measured directly from patron ratings without arbitrary scaling.
            </div>
          </CardContent>
        </Card>

        {/* Recent Feedback Stream */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="size-4 text-amber-500" />
              Recent Customer Reviews
            </CardTitle>
            <Link
              href="/reviews"
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              View all reviews <ChevronRight className="size-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0">
            {recentReviews.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                No customer reviews logged yet.
              </p>
            ) : (
              recentReviews.map((rev) => (
                <div
                  key={rev.id}
                  className="flex flex-col gap-1.5 rounded-lg border p-3 bg-card/60 hover:bg-muted/30 transition-colors text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`size-3.5 ${
                              s <= rev.rating
                                ? 'fill-amber-400 text-amber-500'
                                : 'text-muted-foreground/30'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="font-semibold text-foreground">
                        {rev.customerName || 'Guest Patron'}
                      </span>
                      <span className="text-muted-foreground">• {rev.branchName}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={
                          rev.status === 'PUBLISHED'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px]'
                            : rev.status === 'PENDING'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px]'
                            : 'bg-muted text-muted-foreground text-[10px]'
                        }
                      >
                        {rev.status}
                      </Badge>
                      <span className="text-muted-foreground text-[11px]">
                        {new Date(rev.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </span>
                    </div>
                  </div>

                  {rev.title && (
                    <p className="font-semibold text-foreground mt-0.5">{rev.title}</p>
                  )}
                  <p className="text-muted-foreground italic">
                    {rev.comment ? `"${rev.comment}"` : '(Rating only, no comment provided)'}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active Issues Table */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="size-4 text-rose-500" />
              Active Customer Operational Issues ({activeIssues.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Complaints and service discrepancy tickets requiring branch staff investigation.
            </p>
          </div>
          {canLogIssue && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsIssueDialogOpen(true)}
              className="gap-1 text-xs h-8"
            >
              <Plus className="size-3.5" />
              Log Incident
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Issue #</th>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Customer / Order</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Assigned Staff</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activeIssues.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-muted-foreground text-xs">
                      <CheckCircle2 className="mx-auto size-7 text-emerald-500 mb-1 opacity-70" />
                      All clear! No open or unresolved customer issues.
                    </td>
                  </tr>
                ) : (
                  activeIssues.map((iss) => (
                    <tr key={iss.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono font-semibold text-xs whitespace-nowrap">
                        {iss.issueNumber}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {iss.branchName}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap font-medium">
                        <Badge variant="outline" className="text-[10px]">
                          {iss.type.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge
                          variant="secondary"
                          className={
                            iss.priority === 'URGENT'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-bold text-[10px]'
                              : iss.priority === 'HIGH'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px]'
                              : 'bg-muted text-muted-foreground text-[10px]'
                          }
                        >
                          {iss.priority}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {iss.customerId ? (
                          <Link
                            href={`/customers/${iss.customerId}`}
                            className="font-medium hover:text-primary hover:underline"
                          >
                            {iss.customerName || 'Customer'}
                          </Link>
                        ) : (
                          <span className="italic text-muted-foreground">Guest</span>
                        )}
                        {iss.orderNumber && (
                          <span className="text-muted-foreground ml-1">
                            (#{iss.orderNumber})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-60">
                        <p className="text-xs text-foreground truncate font-medium">
                          {iss.description}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {iss.assignedStaffName ? (
                          <span className="font-medium text-foreground">
                            {iss.assignedStaffName}
                          </span>
                        ) : (
                          <span className="italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <Badge
                          variant="secondary"
                          className={
                            iss.status === 'IN_PROGRESS'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-[10px]'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px]'
                          }
                        >
                          {iss.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {canResolveIssue && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-[11px] text-emerald-600 hover:text-emerald-700"
                              onClick={() =>
                                setActiveIssueAction({ issue: iss, mode: 'RESOLVE' })
                              }
                            >
                              Resolve
                            </Button>
                          )}

                          {canAssignIssue && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-[11px]"
                              onClick={() =>
                                setActiveIssueAction({ issue: iss, mode: 'ASSIGN' })
                              }
                            >
                              Assign
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[11px]"
                            onClick={() =>
                              setActiveIssueAction({ issue: iss, mode: 'STATUS' })
                            }
                          >
                            Status
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Branch Feedback Breakdown Comparison Table */}
      {branches.length > 1 && branchBreakdowns.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              Branch Quality & Sentiment Comparison
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Branch</th>
                    <th className="px-4 py-3 text-center">Reviews</th>
                    <th className="px-4 py-3 text-center">Average Rating</th>
                    <th className="px-4 py-3">Rating Breakdown (1★ - 5★)</th>
                    <th className="px-4 py-3 text-center">Open Issues</th>
                    <th className="px-4 py-3 text-center">Resolved Issues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {branchBreakdowns.map((bb) => (
                    <tr key={bb.branchId} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium text-xs">
                        {bb.branchName}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-xs">
                        {bb.reviewCount}
                      </td>
                      <td className="px-4 py-3 text-center text-xs font-bold text-amber-600 dark:text-amber-400">
                        ★ {bb.averageRating.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          {bb.ratingDistribution.map((rd) => (
                            <span
                              key={rd.star}
                              className={
                                rd.star >= 4
                                  ? 'text-emerald-600 font-medium'
                                  : rd.star === 3
                                  ? 'text-amber-500'
                                  : 'text-rose-600'
                              }
                            >
                              {rd.star}★: {rd.count}
                              {rd.star < 5 ? ' • ' : ''}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-xs">
                        <Badge
                          variant="secondary"
                          className={
                            bb.openIssues > 0
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 text-[10px]'
                              : 'bg-muted text-muted-foreground text-[10px]'
                          }
                        >
                          {bb.openIssues}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        {bb.resolvedIssues}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Log Issue Dialog */}
      <IssueDialog
        open={isIssueDialogOpen}
        onOpenChange={setIsIssueDialogOpen}
        branchId={selectedBranchId || branches[0]?.id}
        branches={branches}
      />

      {/* Issue Action Dialog (Status / Assign / Resolve) */}
      <IssueActionDialog
        open={!!activeIssueAction}
        onOpenChange={(open) => {
          if (!open) setActiveIssueAction(null);
        }}
        issue={activeIssueAction?.issue || null}
        mode={activeIssueAction?.mode || 'STATUS'}
      />
    </div>
  );
}
