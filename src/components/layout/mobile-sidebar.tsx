'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from 'cn';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { mainNavItems, getRoleNavItems } from '@/config/navigation';
import { useSidebar } from '@/providers/sidebar-provider';
import type { AuthUser } from '@/lib/auth/types';
import { hasPermission } from '@/lib/permissions/check';

interface MobileSidebarProps {
  user?: AuthUser | null;
}

export function MobileSidebar({ user }: MobileSidebarProps) {
  const { isMobileOpen, setMobileOpen } = useSidebar();
  const pathname = usePathname();
  const userRole = (user?.role || 'staff').toLowerCase();

  const roleMainNav = getRoleNavItems(userRole, mainNavItems);

  const visibleMainNavItems = roleMainNav.filter((item) => {
    if (!item.requiredPermission) return true;
    return hasPermission(user, item.requiredPermission);
  });

  return (
    <Sheet open={isMobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="flex h-14 flex-row items-center gap-2 border-b px-4">
          <Link
            href={`/${userRole}`}
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2"
          >
            <div className="relative flex size-8 shrink-0 items-center justify-center rounded-lg overflow-hidden bg-white/90 dark:bg-zinc-900 border border-sidebar-border">
              <Image
                src="/logo.png"
                alt="Oven Xpress"
                fill
                sizes="32px"
                className="object-contain p-0.5"
                priority
              />
            </div>
            <div className="flex flex-col text-left">
              <SheetTitle className="text-sm font-semibold">
                Oven Xpress
              </SheetTitle>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {user?.role || 'Portal'}
              </span>
            </div>
          </Link>
        </SheetHeader>

        <nav
          className="flex-1 space-y-1 overflow-y-auto px-3 py-3"
          aria-label="Mobile navigation"
        >
          {visibleMainNavItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== `/${userRole}` && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 min-h-11 text-sm font-medium transition-colors',
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
      </SheetContent>
    </Sheet>
  );
}
