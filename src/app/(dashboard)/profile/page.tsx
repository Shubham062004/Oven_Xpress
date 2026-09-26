import type { Metadata } from 'next';
import { requireAuthentication, getAuthorizedBranchScope } from '@/lib/auth/guards';
import { getProfileData } from '@/lib/profile/profile-actions';
import { prisma } from '@/lib/db/prisma';
import { ProfileClient } from '@/components/profile/profile-client';

export const metadata: Metadata = {
  title: 'My Profile & Account Settings',
  description: 'Manage your personal user profile, security credentials, active sessions, and workspace preferences.',
};

interface ProfilePageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  // Server-side guard: Enforce active authenticated session
  const user = await requireAuthentication('/profile');

  const resolvedParams = await searchParams;
  const initialTab = resolvedParams.tab || 'overview';

  const [profileData, branchScope] = await Promise.all([
    getProfileData(),
    getAuthorizedBranchScope(user),
  ]);

  const branchWhere: { status: 'ACTIVE'; id?: { in: string[] } } = {
    status: 'ACTIVE',
  };
  if (!branchScope.isAllBranches) {
    branchWhere.id = { in: branchScope.branchIds };
  }

  const allBranches = await prisma.branch.findMany({
    where: branchWhere,
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  return (
    <ProfileClient
      initialData={profileData}
      initialTab={initialTab}
      allBranches={allBranches}
    />
  );
}
