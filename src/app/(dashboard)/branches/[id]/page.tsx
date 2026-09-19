import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getBranchById } from '@/lib/branches/actions';
import { BranchDetailClient } from '@/components/branches/branch-detail-client';

interface BranchDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: BranchDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await getBranchById(id);

  if (!result.success || !result.data) {
    return { title: 'Branch Not Found' };
  }

  return {
    title: result.data.name,
    description: `Details for branch ${result.data.name} (${result.data.code})`,
  };
}

export default async function BranchDetailPage({
  params,
}: BranchDetailPageProps) {
  // Server-side guard
  await requirePermission(PERMISSIONS.BRANCH_READ);

  const { id } = await params;
  const result = await getBranchById(id);

  if (!result.success || !result.data) {
    notFound();
  }

  return <BranchDetailClient branch={result.data} />;
}
