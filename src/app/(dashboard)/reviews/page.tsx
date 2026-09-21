import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getReviews } from '@/lib/customers/actions';
import { getBranches } from '@/lib/branches/actions';
import { prisma } from '@/lib/db/prisma';
import { ReviewModerationClient } from '@/components/customers/review-moderation-client';
import type { ReviewStatus, PaginationMeta } from '@/lib/customers/types';

export const metadata: Metadata = {
  title: 'Review Moderation | Oven Xpress',
  description: 'Moderate customer ratings, audit feedback, and manage review visibility.',
};

interface ReviewsPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function ReviewsPage({ searchParams }: ReviewsPageProps) {
  const user = await requirePermission(PERMISSIONS.REVIEW_READ);
  const resolvedParams = await searchParams;

  const isRestrictedBranchUser = user.role === 'MANAGER' || user.role === 'STAFF';
  let userBranchId: string | null = null;

  if (isRestrictedBranchUser) {
    const employee = await prisma.employee.findUnique({
      where: { userId: user.id },
      select: { branchId: true },
    });
    userBranchId = employee?.branchId ?? null;
  }

  const branchId = userBranchId || resolvedParams.branchId;
  const status = resolvedParams.status as ReviewStatus | undefined;
  const rating = resolvedParams.rating ? parseInt(resolvedParams.rating, 10) : undefined;
  const search = resolvedParams.search;
  const page = resolvedParams.page ? parseInt(resolvedParams.page, 10) : 1;

  const [reviewsRes, branchesRes] = await Promise.all([
    getReviews({
      branchId: branchId === 'all' ? undefined : branchId,
      status,
      rating: rating && !isNaN(rating) ? rating : undefined,
      search,
      page: isNaN(page) ? 1 : page,
      pageSize: 20,
    }),
    getBranches({ status: 'ACTIVE' }),
  ]);

  const reviews = reviewsRes.success && reviewsRes.data ? reviewsRes.data.items : [];
  const pagination: PaginationMeta =
    reviewsRes.success && reviewsRes.data
      ? reviewsRes.data.pagination
      : {
          page: 1,
          pageSize: 20,
          total: 0,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        };

  const branches =
    branchesRes.success && branchesRes.data
      ? branchesRes.data.map((b) => ({ id: b.id, name: b.name, city: b.city }))
      : [];

  return (
    <ReviewModerationClient
      initialReviews={reviews}
      initialPagination={pagination}
      branches={branches}
      currentBranchId={branchId || ''}
      currentStatus={status}
      currentRating={rating}
      currentSearch={search || ''}
    />
  );
}
