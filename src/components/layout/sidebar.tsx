'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { mainNavItems, bottomNavItems } from '@/config/navigation';
import { useSidebar } from '@/providers/sidebar-provider';
import type { AuthUser } from '@/lib/auth/types';
import { hasPermission } from '@/lib/permissions/check';

interface SidebarProps {
  user?: AuthUser | null;
}

export function Sidebar({ user }: SidebarProps) {
  const { isCollapsed, toggleCollapsed } = useSidebar();
  const pathname = usePathname();

  // Filter navigation items based on user's assigned permissions
  const visibleMainNavItems = mainNavItems.filter((item) => {
    if (!item.requiredPermission) return true;
    return hasPermission(user, item.requiredPermission);
  });

  const visibleBottomNavItems = bottomNavItems.filter((item) => {
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
      <div
        className={cn(
          'flex h-14 items-center border-b border-sidebar-border px-4',
          isCollapsed ? 'justify-center' : 'gap-2'
        )}
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <span className="text-sm font-bold">OX</span>
        </div>
        {!isCollapsed && (
          <span className="text-sm font-semibold text-sidebar-foreground">
            Oven Xpress
          </span>
        )}
      </div>

      {/* Main Navigation */}
      <nav
        className="flex-1 space-y-1 overflow-y-auto px-2 py-3"
        aria-label="Main navigation"
      >
        {visibleMainNavItems.map((item) => {
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
