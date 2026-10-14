import React from 'react';
import { requireAuthentication } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { CheckoutClient } from '@/components/customer/checkout-client';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Checkout | Oven Xpress',
  description: 'Complete your artisanal food order securely.',
};

export default async function CheckoutPage() {
  const user = await requireAuthentication('/checkout');

  // Query User saved addresses and customer record
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      addresses: true,
      phone: true,
      name: true,
      email: true,
      customer: {
        select: {
          address: true,
          phone: true,
        },
      },
    },
  });

  const rawAddresses = (dbUser?.addresses as unknown) || [];
  const savedAddresses = Array.isArray(rawAddresses) ? rawAddresses : [];

  return (
    <CheckoutClient
      user={{
        id: user.id,
        name: dbUser?.name || user.name,
        email: dbUser?.email || user.email,
        phone: dbUser?.phone || dbUser?.customer?.phone || user.phone,
      }}
      savedAddresses={savedAddresses}
      defaultCustomerAddress={dbUser?.customer?.address || null}
    />
  );
}
