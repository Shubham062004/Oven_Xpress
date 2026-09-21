'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Star,
  CheckCircle2,
  Clock,
  EyeOff,
  Search,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ReportViewContainer, type SummaryCardItem } from './report-view-container';
import { formatNumber } from '@/lib/reports/constants';
import type { ReviewsReportRow, ReviewsReportSummary, PaginationMeta, DateRangePreset } from '@/lib/reports/types';
import { exportReviewsReportCSVAction } from '@/lib/reports/actions';

interface ReviewsReportClientProps {
  rows: ReviewsReportRow[];
  summary: ReviewsReportSummary;
  pagination: PaginationMeta;
  branches: Array<{ id: string; name: string; code: string }>;
  selectedBranchId: string;
  isBranchRestricted: boolean;
  selectedPreset: string;
  startDate?: string;
  endDate?: string;
  currentRating?: string;
  currentStatus?: string;
  currentSearch?: string;
}

export function ReviewsReportClient({
  rows,
  summary,
  pagination,
  branches,
  selectedBranchId,
  isBranchRestricted,
  selectedPreset,
  startDate,
  endDate,
  currentRating = 'all',
  currentStatus = 'all',
  currentSearch = '',
}: ReviewsReportClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(currentSearch);

  const handleFilterChange = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (value === 'all' || !value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.set('page', '1');
    router.push(`/reports/reviews?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleFilterChange('search', search);
  };

  const summaryCards: SummaryCardItem[] = [
    {
      title: 'Total Reviews',
      value: formatNumber(summary.totalReviews),
      subtitle: `${summary.publishedCount} published publicly`,
      icon: <Star className="w-4 h-4 text-amber-500 fill-amber-500" />,
    },
    {
      title: 'Average Rating',
      value: summary.averageRating.toFixed(1),
      subtitle: 'Score across store reviews',
      icon: <Star className="w-4 h-4 text-amber-500" />,
    },
    {
      title: 'Positive Reviews',
      value: formatNumber(
        (summary.ratingBreakdown?.[5] || 0) + (summary.ratingBreakdown?.[4] || 0)
      ),
      subtitle: '4 & 5-star positive ratings',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    },
    {
      title: 'Pending Moderation',
      value: formatNumber(summary.pendingCount),
      subtitle: 'Awaiting manager publication review',
      icon: <Clock className="w-4 h-4 text-blue-500" />,
    },
  ];

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-3.5 h-3.5 ${
              star <= rating
                ? 'text-amber-500 fill-amber-500'
                : 'text-muted-foreground/30'
            }`}
          />
        ))}
        <span className="ml-1.5 text-xs font-semibold">{rating}</span>
      </div>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Published
          </Badge>
        );
      case 'PENDING':
        return (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
            <Clock className="w-3 h-3 mr-1" />
            Pending Review
          </Badge>
        );
      case 'HIDDEN':
        return (
          <Badge variant="destructive">
            <EyeOff className="w-3 h-3 mr-1" />
            Hidden
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleExport = async () => {
    const res = await exportReviewsReportCSVAction({
      branchId: selectedBranchId,
      preset: selectedPreset as DateRangePreset,
      startDate,
      endDate,
      rating: currentRating === 'all' ? undefined : parseInt(currentRating, 10),
      status: currentStatus === 'all' ? undefined : currentStatus,
      search: currentSearch || undefined,
    });
    if (!res.success || !res.csv) throw new Error(res.error || 'Failed to export CSV');
    return res.csv;
  };

  return (
    <ReportViewContainer
      title="Customer Feedback & Reviews Report"
      description="Direct customer dining experience ratings, feedback commentary, and moderation records."
      branches={branches}
      selectedBranchId={selectedBranchId}
      isBranchRestricted={isBranchRestricted}
      selectedPreset={selectedPreset}
      startDate={startDate}
      endDate={endDate}
      summaryCards={summaryCards}
      pagination={pagination}
      onExportCSV={handleExport}
      extraFilters={
        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search customer, comment..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </form>

          <Select
            value={currentRating}
            onValueChange={(val) => handleFilterChange('rating', val)}
          >
            <SelectTrigger className="w-[140px] h-9 text-xs">
              <SelectValue placeholder="All Ratings" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ratings</SelectItem>
              <SelectItem value="5">5 Stars</SelectItem>
              <SelectItem value="4">4 Stars</SelectItem>
              <SelectItem value="3">3 Stars</SelectItem>
              <SelectItem value="2">2 Stars</SelectItem>
              <SelectItem value="1">1 Star</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={currentStatus}
            onValueChange={(val) => handleFilterChange('status', val)}
          >
            <SelectTrigger className="w-[140px] h-9 text-xs">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="APPROVED">Published</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="REJECTED">Hidden</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
    >
      <Card className="border shadow-xs">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold text-xs">Date</TableHead>
                  <TableHead className="font-semibold text-xs">Branch</TableHead>
                  <TableHead className="font-semibold text-xs">Rating</TableHead>
                  <TableHead className="font-semibold text-xs">Customer</TableHead>
                  <TableHead className="font-semibold text-xs">Order #</TableHead>
                  <TableHead className="font-semibold text-xs">Comment</TableHead>
                  <TableHead className="font-semibold text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-36 text-center text-muted-foreground text-sm">
                      No customer reviews found matching the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id} className="hover:bg-muted/30">
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-foreground">
                        {row.branchName}
                      </TableCell>
                      <TableCell className="text-xs">{renderStars(row.rating)}</TableCell>
                      <TableCell className="text-xs font-medium text-foreground">
                        {row.customerName}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {row.orderNumber || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-md">
                        {row.comment ? `"${row.comment}"` : <span className="italic">No written comment</span>}
                      </TableCell>
                      <TableCell className="text-xs">{getStatusBadge(row.status)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </ReportViewContainer>
  );
}
