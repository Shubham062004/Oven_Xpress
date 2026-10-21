'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { PanelLeftClose, PanelLeftOpen, LogOut } from 'lucide-react';

import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { logoutAction } from '@/lib/auth/actions';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { mainNavItems, bottomNavItems, getRoleNavItems } from '@/config/navigation';
import { useSidebar } from '@/providers/sidebar-provider';
import type { AuthUser } from '@/lib/auth/types';
import { hasPermission } from '@/lib/permissions/check';

interface SidebarProps {
  user?: AuthUser | null;
}

export function Sidebar({ user }: SidebarProps) {
  const { isCollapsed, toggleCollapsed } = useSidebar();
  const pathname = usePathname();
  const userRole = (user?.role || 'staff').toLowerCase();

  const roleMainNav = getRoleNavItems(userRole, mainNavItems);
  const roleBottomNav = getRoleNavItems(userRole, bottomNavItems);

  // Filter navigation items based on user's assigned permissions
  const visibleMainNavItems = roleMainNav.filter((item) => {
    if (!item.requiredPermission) return true;
    return hasPermission(user, item.requiredPermission);
  });

  const visibleBottomNavItems = roleBottomNav.filter((item) => {
    if (!item.requiredPermission) return true;
    return hasPermission(user, item.requiredPermission);
  });

  return (
    <aside
      data-collapsed={isCollapsed}
      className={cn(
        'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-in-out lg:flex',
        isCollapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Brand */}
      <Link
        href={`/${userRole}`}
        className={cn(
          'flex h-14 items-center border-b border-sidebar-border px-4 transition-colors hover:bg-sidebar-accent/50',
          isCollapsed ? 'justify-center' : 'gap-2'
        )}
      >
        <div className="relative flex size-8 shrink-0 items-center justify-center rounded-lg overflow-hidden bg-white/90 dark:bg-zinc-900 border border-sidebar-border">
          <Image
            src="/logo.png"
            alt="Oven Express"
            fill
            sizes="32px"
            className="object-contain p-0.5"
            priority
          />
        </div>
        {!isCollapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-sidebar-foreground truncate">
              Oven Express
            </span>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              {user?.role || 'Portal'}
            </span>
          </div>
        )}
      </Link>

      {/* Main Navigation */}
      <nav
        className="flex-1 space-y-1 overflow-y-auto px-2 py-3"
        aria-label="Main navigation"
      >
        {visibleMainNavItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== `/${userRole}` && pathname.startsWith(`${item.href}/`));
          const linkContent = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground/70',
                isCollapsed && 'justify-center px-0'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <item.icon className="size-4 shrink-0" />
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          );

          if (isCollapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger render={<span />}>
                  {linkContent}
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          }

          return linkContent;
        })}
      </nav>

      {/* Bottom Section */}
      <div className="px-2 pb-3">
        <Separator className="mb-3" />
        {visibleBottomNavItems.map((item) => {
          const isActive = pathname === item.href;
          const linkContent = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground/70',
                isCollapsed && 'justify-center px-0'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <item.icon className="size-4 shrink-0" />
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          );

          if (isCollapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger render={<span />}>
                  {linkContent}
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          }

          return linkContent;
        })}

        {/* Logout Button */}
        {isCollapsed ? (
          <form action={logoutAction} className="w-full mt-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon"
                    className="w-full justify-center text-destructive hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Logout"
                  >
                    <LogOut className="size-4 shrink-0" />
                  </Button>
                }
              />
              <TooltipContent side="right">Logout</TooltipContent>
            </Tooltip>
          </form>
        ) : (
          <form action={logoutAction} className="w-full mt-1">
            <Button
              type="submit"
              variant="ghost"
              className="w-full justify-start gap-3 px-3 text-destructive hover:bg-destructive/10 hover:text-destructive text-sm font-medium"
              aria-label="Logout"
            >
              <LogOut className="size-4 shrink-0" />
              <span>Logout</span>
            </Button>
          </form>
        )}

        {/* Collapse Toggle */}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size={isCollapsed ? 'icon' : 'default'}
                onClick={toggleCollapsed}
                className={cn(
                  'mt-1 w-full text-sidebar-foreground/70',
                  isCollapsed ? 'justify-center' : 'justify-start gap-3 px-3'
                )}
                aria-label={
                  isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'
                }
              />
            }
          >
            {isCollapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <>
                <PanelLeftClose className="size-4" />
                <span>Collapse</span>
              </>
            )}
          </TooltipTrigger>
          {isCollapsed && (
            <TooltipContent side="right">Expand sidebar</TooltipContent>
          )}
        </Tooltip>
      </div>
    </aside>
  );
}
