import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getAuthorizedBranchScope } from '@/lib/reports/report-service';
import { prisma } from '@/lib/db/prisma';
import { getAllSettings, getUserPreferences } from '@/lib/settings/settings-service';
import { SettingsClient } from '@/components/settings/settings-client';

export const metadata: Metadata = {
  title: 'Settings & System Configuration | Oven Xpress',
  description: 'Manage centralized business parameters, branch defaults, operational thresholds, and UI preferences.',
};

interface SettingsPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  // Server-side RBAC guard: enforces settings.read permission
  const user = await requirePermission(PERMISSIONS.SETTINGS_READ);

  const resolvedParams = await searchParams;
  const branchScope = await getAuthorizedBranchScope(user);

  let targetBranchId: string | null = null;

  if (branchScope.isAllBranches) {
    targetBranchId = resolvedParams.branchId || null;
  } else {
    // Restricted branch scope: user can only view their assigned branch
    if (resolvedParams.branchId && branchScope.branchIds.includes(resolvedParams.branchId)) {
      targetBranchId = resolvedParams.branchId;
    } else if (branchScope.branchIds.length > 0) {
      targetBranchId = branchScope.branchIds[0];
    }
  }

  // Load authorized branches for the dropdown
  const branchWhere: { status: 'ACTIVE'; id?: { in: string[] } } = {
    status: 'ACTIVE',
  };
  if (!branchScope.isAllBranches) {
    branchWhere.id = { in: branchScope.branchIds };
  }

  const [settings, authorizedBranches, userPreferences] = await Promise.all([
    getAllSettings(targetBranchId),
    prisma.branch.findMany({
      where: branchWhere,
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    getUserPreferences(user.id),
  ]);

  return (
    <SettingsClient
      initialSettings={settings}
      authorizedBranches={authorizedBranches}
      isAllBranches={branchScope.isAllBranches}
      userRole={user.role}
      userPermissions={user.permissions}
      initialBranchId={targetBranchId}
      userPreferences={userPreferences}
    />
  );
}
