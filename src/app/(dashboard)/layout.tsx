import { requireAuthentication } from '@/lib/auth/guards';
import { SidebarProvider } from '@/providers/sidebar-provider';
import { AuthProvider } from '@/providers/auth-provider';
import { AppShell } from '@/components/layout/app-shell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side guard: All dashboard routes require an active authenticated session
  const user = await requireAuthentication();

  return (
    <AuthProvider user={user}>
      <SidebarProvider>
        <AppShell user={user}>{children}</AppShell>
      </SidebarProvider>
    </AuthProvider>
  );
}
