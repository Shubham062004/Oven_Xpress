'use client';

import { cn } from 'cn';
import { Sidebar } from '@/components/layout/sidebar';
import { MobileSidebar } from '@/components/layout/mobile-sidebar';
import { Header } from '@/components/layout/header';
import { useSidebar } from '@/providers/sidebar-provider';
import type { AuthUser } from '@/lib/auth/types';

interface AppShellProps {
  children: React.ReactNode;
  user?: AuthUser | null;
}

export function AppShell({ children, user }: AppShellProps) {
  const { isCollapsed } = useSidebar();

  return (
    <div
      className={cn(
        'relative min-h-screen w-full transition-[padding] duration-200 ease-in-out',
        isCollapsed ? 'lg:pl-16' : 'lg:pl-60'
      )}
    >
      {/* Desktop sidebar with permission-filtered nav */}
      <Sidebar user={user} />

      {/* Mobile sidebar (drawer) */}
      <MobileSidebar user={user} />

      {/* Main content area */}
      <div className="flex min-h-screen flex-col min-w-0 w-full">
        <Header user={user} />
        <main className="flex-1 min-w-0 w-full px-3 py-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
