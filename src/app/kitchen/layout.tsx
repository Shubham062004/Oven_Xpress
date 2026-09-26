import type { Metadata } from 'next';
import { requireAuthentication } from '@/lib/auth/guards';
import { validateSession } from '@/lib/auth/session';
import { AuthProvider } from '@/providers/auth-provider';
import { SessionTimeoutWatcher } from '@/components/auth/session-timeout-watcher';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Kitchen Display System (KDS)',
  description: 'Real-time kitchen order preparation and display system.',
};

export default async function KitchenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server guard: Active authenticated session is required
  const user = await requireAuthentication();
  const sessionResult = await validateSession();

  return (
    <AuthProvider user={user} expiresAt={sessionResult.expiresAt?.getTime()}>
      <div className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-amber-500 selection:text-white">
        {children}
        <SessionTimeoutWatcher />
      </div>
    </AuthProvider>
  );
}
