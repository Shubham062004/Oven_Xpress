import React from 'react';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getCustomerProfile } from '@/lib/customer/customer-profile-actions';
import { CustomerProfileClient } from '@/components/customer/customer-profile-client';

export const metadata: Metadata = {
  title: 'My Profile | Oven Xpress',
  description: 'View and manage your Oven Xpress customer account profile, contact details, and password.',
};

export default async function CustomerProfilePage() {
  const profile = await getCustomerProfile();

  if (!profile) {
    redirect('/login?callbackUrl=/account/profile');
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <CustomerProfileClient initialData={profile} />
    </div>
  );
}
