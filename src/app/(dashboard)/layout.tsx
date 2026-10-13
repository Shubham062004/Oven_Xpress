import { redirect } from 'next/navigation';
import { validateSession } from '@/lib/auth/session';
import { isSafeRedirectUrl } from '@/lib/security/url-validation';
import { SidebarProvider } from '@/providers/sidebar-provider';
import { AuthProvider } from '@/providers/auth-provider';
import { AppShell } from '@/components/layout/app-shell';
import { SessionTimeoutWatcher } from '@/components/auth/session-timeout-watcher';

// Enforce dynamic server rendering for all authenticated dashboard pages
// Prevents serving stale/cached authenticated states
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Single session validation — avoids the double DB round trip that
  // calling requireAuthentication() + validateSession() separately caused.
  const sessionResult = await validateSession();

  if (!sessionResult.user) {
    const params = new URLSearchParams();
    if (sessionResult.status === 'EXPIRED') {
      params.set('reason', 'session-expired');
    } else if (sessionResult.status === 'USER_INACTIVE') {
      params.set('error', 'account-inactive');
    }
    const qs = params.toString();
    redirect(qs ? `/login?${qs}` : '/login');
  }

  const user = sessionResult.user;

  return (
    <AuthProvider user={user} expiresAt={sessionResult.expiresAt?.getTime()}>
      <SidebarProvider>
        <AppShell user={user}>{children}</AppShell>
        <SessionTimeoutWatcher />
      </SidebarProvider>
    </AuthProvider>
  );
}
