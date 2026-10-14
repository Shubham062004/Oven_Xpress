import { redirect } from 'next/navigation';

export default async function BranchRootPage({
  params,
}: {
  params: Promise<{ branchSlug: string }>;
}) {
  const { branchSlug } = await params;
  redirect(`/b/${branchSlug}/menu`);
}
