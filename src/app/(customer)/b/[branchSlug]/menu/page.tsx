import React from 'react';
import { notFound } from 'next/navigation';
import { getPublicBranchMenu } from '@/lib/customer/menu-service';
import { MenuClient } from '@/components/customer/menu-client';
import type { Metadata } from 'next';

interface MenuPageProps {
  params: Promise<{
    branchSlug: string;
  }>;
}

export async function generateMetadata({ params }: MenuPageProps): Promise<Metadata> {
  const { branchSlug } = await params;
  const data = await getPublicBranchMenu(branchSlug);

  if (!data) {
    return {
      title: 'Branch Menu | Oven Xpress',
    };
  }

  return {
    title: `${data.branch.name} Menu | Oven Xpress`,
    description: `Explore artisan wood-fired pizzas, garlic breads, burgers and desserts at Oven Xpress ${data.branch.name}. Fast delivery and takeaway.`,
  };
}

export default async function BranchMenuPage({ params }: MenuPageProps) {
  const { branchSlug } = await params;
  const data = await getPublicBranchMenu(branchSlug);

  if (!data) {
    notFound();
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
      <MenuClient data={data} />
    </div>
  );
}
