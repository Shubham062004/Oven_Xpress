'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User as UserIcon } from 'lucide-react';

import { cn } from 'cn';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { mainNavItems, bottomNavItems } from '@/config/navigation';
import { useSidebar } from '@/providers/sidebar-provider';
import type { AuthUser } from '@/lib/auth/types';
import { hasPermission } from '@/lib/permissions/check';

interface MobileSidebarProps {
  user?: AuthUser | null;
}

export function MobileSidebar({ user }: MobileSidebarProps) {
  const { isMobileOpen, setMobileOpen } = useSidebar();
  const pathname = usePathname();

  const visibleMainNavItems = mainNavItems.filter((item) => {
    if (!item.requiredPermission) return true;
    return hasPermission(user, item.requiredPermission);
  });

  const visibleBottomNavItems = bottomNavItems.filter((item) => {
    if (!item.requiredPermission) return true;
    return hasPermission(user, item.requiredPermission);
  });

  return (
    <Sheet open={isMobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="flex h-14 flex-row items-center gap-2 border-b px-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <span className="text-sm font-bold">OX</span>
          </div>
          <SheetTitle className="text-sm font-semibold">
            Oven Xpress
          </SheetTitle>
        </SheetHeader>

        <nav
          className="flex-1 space-y-1 overflow-y-auto px-3 py-3"
          aria-label="Mobile navigation"
        >
          {visibleMainNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'bg-accent text-primary'
                    : 'text-muted-foreground'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <item.icon className="size-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pb-3">
          <Separator className="mb-3" />
          {user ? (
            <Link
              href="/profile"
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors mb-1',
                pathname.startsWith('/profile')
                  ? 'bg-accent text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <UserIcon className="size-4 shrink-0" />
              <span>My Profile</span>
            </Link>
          ) : null}
          {visibleBottomNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'bg-accent text-primary'
                    : 'text-muted-foreground'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <item.icon className="size-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
