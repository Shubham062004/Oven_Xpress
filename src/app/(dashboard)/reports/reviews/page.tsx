import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAuthentication } from '@/lib/auth/guards';
import { hasAnyPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getReviewsReportAction } from '@/lib/reports/actions';
import { ReviewsReportClient } from '@/components/reports/reviews-report-client';

export const metadata: Metadata = {
  title: 'Customer Feedback & Reviews Report | Oven Xpress',
  description: 'Direct customer dining experience ratings, feedback commentary, and moderation records.',
};

interface ReviewsReportPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function ReviewsReportPage({ searchParams }: ReviewsReportPageProps) {
  const user = await requireAuthentication('/reports/reviews');

  if (
    !hasAnyPermission(user, [
      PERMISSIONS.REPORT_REVIEW_READ,
      PERMISSIONS.REPORT_CUSTOMER_READ,
      PERMISSIONS.REVIEW_READ,
    ])
  ) {
    redirect('/unauthorized');
  }

  const resolved = await searchParams;
  const page = resolved.page ? parseInt(resolved.page, 10) : 1;
  const preset = (resolved.preset as any) || (!resolved.startDate && !resolved.endDate ? 'today' : 'custom');

  const res = await getReviewsReportAction({
    branchId: resolved.branchId,
    preset,
    startDate: resolved.startDate,
    endDate: resolved.endDate,
    rating: resolved.rating ? parseInt(resolved.rating, 10) : undefined,
    status: resolved.status,
    search: resolved.search,
    page,
    limit: 25,
  });

  if (!res.success) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="text-base font-semibold text-rose-600">Failed to load reviews report</p>
        <p className="text-sm mt-1">{res.error || 'Unknown error occurred.'}</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <ReviewsReportClient
        rows={res.data.rows}
        summary={res.data.summary}
        pagination={res.data.pagination}
        branches={res.data.branches}
        selectedBranchId={res.data.selectedBranchId}
        isBranchRestricted={res.data.isBranchRestricted}
        selectedPreset={preset}
        startDate={resolved.startDate}
        endDate={resolved.endDate}
        currentRating={resolved.rating || 'all'}
        currentStatus={resolved.status || 'all'}
        currentSearch={resolved.search || ''}
      />
    </div>
  );
}
