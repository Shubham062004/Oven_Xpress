'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { mainNavItems, getRoleNavItems } from '@/config/navigation';
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

  // Filter navigation items based on user's assigned permissions
  const visibleMainNavItems = roleMainNav.filter((item) => {
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
      {/* Brand & Collapse Header */}
      <div
        className={cn(
          'flex h-14 items-center border-b border-sidebar-border transition-colors',
          isCollapsed ? 'justify-center px-2' : 'justify-between px-3'
        )}
      >
        {isCollapsed ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleCollapsed}
                  className="size-9 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground"
                  aria-label="Expand sidebar"
                >
                  <PanelLeftOpen className="size-4" />
                </Button>
              }
            />
            <TooltipContent side="right">Expand sidebar</TooltipContent>
          </Tooltip>
        ) : (
          <>
            <Link
              href={`/${userRole}`}
              className="flex items-center gap-2.5 min-w-0 transition-opacity hover:opacity-80"
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
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-sidebar-foreground truncate">
                  Oven Xpress
                </span>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  {user?.role || 'Portal'}
                </span>
              </div>
            </Link>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleCollapsed}
                    className="size-8 shrink-0 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
                    aria-label="Collapse sidebar"
                  >
                    <PanelLeftClose className="size-4" />
                  </Button>
                }
              />
              <TooltipContent side="right">Collapse sidebar</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>

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
    </aside>
  );
}
