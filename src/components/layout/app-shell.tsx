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
    <div className="relative flex min-h-screen">
      {/* Desktop sidebar with permission-filtered nav */}
      <Sidebar user={user} />

      {/* Mobile sidebar (drawer) */}
      <MobileSidebar user={user} />

      {/* Main content area */}
      <div
        className={cn(
          'flex min-h-screen flex-1 flex-col transition-[margin] duration-200 ease-in-out',
          isCollapsed ? 'lg:ml-16' : 'lg:ml-60'
        )}
      >
        <Header user={user} />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
