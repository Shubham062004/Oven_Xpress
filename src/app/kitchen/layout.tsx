import type { Metadata } from 'next';
import { requireAuthentication } from '@/lib/auth/guards';
import { AuthProvider } from '@/providers/auth-provider';

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

  return (
    <AuthProvider user={user}>
      <div className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-amber-500 selection:text-white">
        {children}
      </div>
    </AuthProvider>
  );
}
