import { requireAuthentication } from '@/lib/auth/guards';
import { validateSession } from '@/lib/auth/session';
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
  // Server-side guard: All dashboard routes require an active authenticated session
  const user = await requireAuthentication();
  const sessionResult = await validateSession();

  return (
    <AuthProvider user={user} expiresAt={sessionResult.expiresAt?.getTime()}>
      <SidebarProvider>
        <AppShell user={user}>{children}</AppShell>
        <SessionTimeoutWatcher />
      </SidebarProvider>
    </AuthProvider>
  );
}
