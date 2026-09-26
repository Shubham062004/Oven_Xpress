import type { Metadata } from 'next';
import { requireAuthentication } from '@/lib/auth/guards';
import { ChangePasswordClient } from '@/components/profile/change-password-client';

export const metadata: Metadata = {
  title: 'Change Password',
  description: 'Update your account login password with enterprise-grade complexity standards.',
};

export default async function ChangePasswordPage() {
  // Server-side guard: Enforce active authenticated session
  const user = await requireAuthentication('/profile/password');

  return <ChangePasswordClient userName={user.name} />;
}
