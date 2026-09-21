'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Star,
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  CheckCircle2,
  Clock,
  Users,
  Plus,
  ShieldCheck,
  Receipt,
} from 'lucide-react';
import { toast } from 'sonner';

import type { ReviewItem, ReviewStatus, PaginationMeta } from '@/lib/customers/types';
import { moderateReview } from '@/lib/customers/actions';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { useAuth } from '@/providers/auth-provider';
import { hasPermission } from '@/lib/permissions/check';

import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ReviewDialog } from '@/components/customers/review-dialog';

interface ReviewModerationClientProps {
  initialReviews: ReviewItem[];
  initialPagination: PaginationMeta;
  branches: Array<{ id: string; name: string; city: string }>;
  currentBranchId?: string;
  currentStatus?: ReviewStatus;
  currentRating?: number;
  currentSearch?: string;
}

export function ReviewModerationClient({
  initialReviews,
  initialPagination,
  branches,
  currentBranchId = '',
  currentStatus,
  currentRating,
  currentSearch = '',
}: ReviewModerationClientProps) {
  const router = useRouter();
  const authUser = useAuth();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(currentSearch);
  const [branchFilter, setBranchFilter] = useState(currentBranchId);
  const [statusFilter, setStatusFilter] = useState<string>(currentStatus || '');
  const [ratingFilter, setRatingFilter] = useState<string>(
    currentRating ? currentRating.toString() : ''
  );

  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);

  const canModerate = hasPermission(authUser, PERMISSIONS.REVIEW_MODERATE);

  const applyFilters = (
    newBranch?: string,
    newStatus?: string,
    newRating?: string,
    newSearch?: string
  ) => {
    const params = new URLSearchParams();
    const b = newBranch !== undefined ? newBranch : branchFilter;
    const s = newStatus !== undefined ? newStatus : statusFilter;
    const r = newRating !== undefined ? newRating : ratingFilter;
    const q = newSearch !== undefined ? newSearch : search;

    if (b) params.set('branchId', b);
    if (s) params.set('status', s);
    if (r) params.set('rating', r);
    if (q.trim()) params.set('search', q.trim());

    startTransition(() => {
      router.push(`/reviews?${params.toString()}`);
    });
  };

  const resetFilters = () => {
    setSearch('');
    setBranchFilter('');
    setStatusFilter('');
    setRatingFilter('');
    startTransition(() => {
      router.push('/reviews');
    });
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams();
    if (branchFilter) params.set('branchId', branchFilter);
    if (statusFilter) params.set('status', statusFilter);
    if (ratingFilter) params.set('rating', ratingFilter);
    if (search.trim()) params.set('search', search.trim());
    params.set('page', newPage.toString());

    startTransition(() => {
      router.push(`/reviews?${params.toString()}`);
    });
  };

  const handleModerate = (
    reviewId: string,
    status: 'PUBLISHED' | 'HIDDEN' | 'RESOLVED',
    notes?: string
  ) => {
    startTransition(async () => {
      const res = await moderateReview({
        reviewId,
        status,
        notes,
      });

      if (res.success) {
        toast.success(`Review updated to ${status}`);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to moderate review');
      }
    });
  };

  const totalReviews = initialPagination.total;
  const pendingCount = initialReviews.filter((r) => r.status === 'PENDING').length;
  const publishedCount = initialReviews.filter((r) => r.status === 'PUBLISHED').length;
  const avgRating =
    initialReviews.length > 0
      ? (
          initialReviews.reduce((sum, r) => sum + r.rating, 0) / initialReviews.length
        ).toFixed(1)
      : '0.0';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review Moderation"
        description="Audit, publish, and moderate dining experience ratings and customer reviews across all branch locations."
      >
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsSubmitDialogOpen(true)}
            className="gap-1.5"
          >
            <Plus className="size-4" />
            Submit Feedback
          </Button>
        </div>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Total Reviews</p>
            <Star className="size-4 text-amber-500 fill-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight">{totalReviews}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Submitted customer reviews
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Average Rating</p>
            <Star className="size-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
            ★ {avgRating}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Page average score (1–5)
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Pending Review</p>
            <Clock className="size-4 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
            {pendingCount}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Awaiting staff moderation
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Published</p>
            <ShieldCheck className="size-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {publishedCount}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Visible on store dashboards
          </p>
        </Card>
      </div>

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
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm"
        >
          <Star className="size-3.5" />
          Reviews & Moderation
        </Link>
        <Link
          href="/feedback"
          className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Receipt className="size-3.5" />
          Feedback Dashboard
        </Link>
      </div>

      {/* Filters Bar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center flex-wrap">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search reviews by customer, order #, or comment..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter')
                    applyFilters(branchFilter, statusFilter, ratingFilter, search);
                }}
                className="pl-9"
              />
            </div>

            {/* Branch Filter */}
            {branches.length > 1 && (
              <select
                value={branchFilter}
                onChange={(e) => {
                  setBranchFilter(e.target.value);
                  applyFilters(e.target.value, statusFilter, ratingFilter, search);
                }}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                applyFilters(branchFilter, e.target.value, ratingFilter, search);
              }}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending Moderation</option>
              <option value="PUBLISHED">Published</option>
              <option value="HIDDEN">Hidden</option>
              <option value="RESOLVED">Resolved</option>
            </select>

            {/* Rating Filter */}
            <select
              value={ratingFilter}
              onChange={(e) => {
                setRatingFilter(e.target.value);
                applyFilters(branchFilter, statusFilter, e.target.value, search);
              }}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">All Ratings</option>
              <option value="5">⭐⭐⭐⭐⭐ (5 Stars)</option>
              <option value="4">⭐⭐⭐⭐ (4 Stars)</option>
              <option value="3">⭐⭐⭐ (3 Stars)</option>
              <option value="2">⭐⭐ (2 Stars)</option>
              <option value="1">⭐ (1 Star)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyFilters()}
              disabled={isPending}
            >
              Filter
            </Button>
            {(search || branchFilter || statusFilter || ratingFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="gap-1 text-muted-foreground"
              >
                <RotateCcw className="size-3.5" />
                Reset
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Reviews Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Rating</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Review & Comment</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Moderation Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {initialReviews.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground">
                      <Star className="mx-auto size-9 opacity-30 mb-2" />
                      <p className="text-base font-semibold">No reviews found</p>
                      <p className="text-xs">
                        Reviews will appear here when submitted by dining patrons.
                      </p>
                    </td>
                  </tr>
                ) : (
                  initialReviews.map((rev) => (
                    <tr key={rev.id} className="hover:bg-muted/30 transition-colors">
                      {/* Rating Column */}
                      <td className="px-4 py-3 whitespace-nowrap font-medium">
                        <div className="flex items-center gap-1">
                          <Star className="size-4 fill-amber-400 text-amber-500" />
                          <span className="font-bold">{rev.rating}</span>
                          <span className="text-xs text-muted-foreground">/ 5</span>
                        </div>
                      </td>

                      {/* Customer Column */}
                      <td className="px-4 py-3 whitespace-nowrap text-xs">
                        {rev.customerId ? (
                          <Link
                            href={`/customers/${rev.customerId}`}
                            className="font-medium text-foreground hover:text-primary hover:underline"
                          >
                            {rev.customerName || 'Customer'}
                          </Link>
                        ) : (
                          <span className="italic text-muted-foreground">Guest Patron</span>
                        )}
                      </td>

                      {/* Branch Column */}
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {rev.branchName}
                      </td>

                      {/* Order Column */}
                      <td className="px-4 py-3 text-xs font-mono whitespace-nowrap">
                        {rev.orderId ? (
                          <Link
                            href={`/orders/${rev.orderId}`}
                            className="hover:underline text-primary"
                          >
                            {rev.orderNumber}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Review Comment */}
                      <td className="px-4 py-3 max-w-80">
                        {rev.title && (
                          <p className="font-semibold text-xs text-foreground mb-0.5">
                            {rev.title}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {rev.comment ? (
                            `"${rev.comment}"`
                          ) : (
                            <span className="italic opacity-60">(Rating only, no comment provided)</span>
                          )}
                        </p>
                      </td>

                      {/* Status Badge */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <Badge
                          variant="secondary"
                          className={
                            rev.status === 'PUBLISHED'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px]'
                              : rev.status === 'PENDING'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px]'
                              : rev.status === 'RESOLVED'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-[10px]'
                              : 'bg-muted text-muted-foreground text-[10px]'
                          }
                        >
                          {rev.status}
                        </Badge>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(rev.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Moderation Actions */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {canModerate ? (
                          <div className="flex items-center justify-end gap-1">
                            {rev.status !== 'PUBLISHED' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-[11px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                onClick={() => handleModerate(rev.id, 'PUBLISHED')}
                                disabled={isPending}
                              >
                                <Eye className="size-3 mr-1" />
                                Publish
                              </Button>
                            )}

                            {rev.status !== 'HIDDEN' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                                onClick={() => handleModerate(rev.id, 'HIDDEN')}
                                disabled={isPending}
                              >
                                <EyeOff className="size-3 mr-1" />
                                Hide
                              </Button>
                            )}

                            {rev.status !== 'RESOLVED' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-[11px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                                onClick={() => handleModerate(rev.id, 'RESOLVED')}
                                disabled={isPending}
                              >
                                <CheckCircle2 className="size-3 mr-1" />
                                Resolve
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Read-only</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {initialPagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Showing{' '}
                <span className="font-medium">
                  {(initialPagination.page - 1) * initialPagination.pageSize + 1}
                </span>{' '}
                to{' '}
                <span className="font-medium">
                  {Math.min(
                    initialPagination.page * initialPagination.pageSize,
                    initialPagination.total
                  )}
                </span>{' '}
                of <span className="font-medium">{initialPagination.total}</span> reviews
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(initialPagination.page - 1)}
                  disabled={initialPagination.page <= 1 || isPending}
                  className="gap-1 h-8"
                >
                  <ChevronLeft className="size-3.5" />
                  Previous
                </Button>
                <span className="text-xs font-medium">
                  {initialPagination.page} / {initialPagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(initialPagination.page + 1)}
                  disabled={
                    initialPagination.page >= initialPagination.totalPages || isPending
                  }
                  className="gap-1 h-8"
                >
                  Next
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submit Review Dialog */}
      <ReviewDialog
        open={isSubmitDialogOpen}
        onOpenChange={setIsSubmitDialogOpen}
        branchId={branchFilter || branches[0]?.id || ''}
        branchName={
          branches.find((b) => b.id === (branchFilter || branches[0]?.id))?.name ||
          'Branch'
        }
      />
    </div>
  );
}
