import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getFeedbackDashboardData, getBranchFeedbackSummary } from '@/lib/customers/actions';
import { getBranches } from '@/lib/branches/actions';
import { prisma } from '@/lib/db/prisma';
import { FeedbackDashboardClient } from '@/components/customers/feedback-dashboard-client';
import type { FeedbackDashboardData, BranchFeedbackSummary } from '@/lib/customers/types';

export const metadata: Metadata = {
  title: 'Customer Feedback & Ratings Dashboard | Oven Xpress',
  description: 'Track customer satisfaction, star ratings distribution, operational issues, and branch quality.',
};

interface FeedbackPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function FeedbackPage({ searchParams }: FeedbackPageProps) {
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

  const [feedbackRes, branchSummariesRes, branchesRes] = await Promise.all([
    getFeedbackDashboardData({
      branchId: branchId === 'all' ? undefined : branchId,
    }),
    getBranchFeedbackSummary(),
    getBranches({ status: 'ACTIVE' }),
  ]);

  const data: FeedbackDashboardData =
    feedbackRes.success && feedbackRes.data
      ? feedbackRes.data
      : {
          totalReviews: 0,
          averageRating: 0,
          pendingReviews: 0,
          openIssues: 0,
          resolvedIssues: 0,
          ratingDistribution: [1, 2, 3, 4, 5].map((s) => ({
            star: s,
            count: 0,
            percentage: 0,
          })),
          recentReviews: [],
          activeIssues: [],
        };

  const branchBreakdowns: BranchFeedbackSummary[] =
    branchSummariesRes.success && branchSummariesRes.data
      ? branchSummariesRes.data
      : [];

  const branches =
    branchesRes.success && branchesRes.data
      ? branchesRes.data.map((b) => ({ id: b.id, name: b.name }))
      : [];

  return (
    <FeedbackDashboardClient
      data={data}
      branchBreakdowns={branchBreakdowns}
      branches={branches}
      currentBranchId={branchId || ''}
    />
  );
}
