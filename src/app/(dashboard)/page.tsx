import { redirect } from 'next/navigation';
import { requireAuthentication } from '@/lib/auth/guards';

export default async function RootDashboardPage() {
  const user = await requireAuthentication('/');
  const roleSlug = (user.role || 'staff').toLowerCase();
  redirect(`/${roleSlug}`);
}
