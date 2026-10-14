import { redirect } from 'next/navigation';
import { requireAuthentication } from '@/lib/auth/guards';

export default async function DashboardRedirectPage() {
  const user = await requireAuthentication('/dashboard');
  const roleSlug = (user.role || 'staff').toLowerCase();
  redirect(`/${roleSlug}`);
}
