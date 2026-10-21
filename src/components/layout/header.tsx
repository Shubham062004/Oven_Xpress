'use client';

import {
  Building2,
  LogOut,
  Menu,
  Search,
  Settings as SettingsIcon,
  User as UserIcon,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/theme-toggle';
import { useSidebar } from '@/providers/sidebar-provider';
import type { AuthUser } from '@/lib/auth/types';
import { logoutAction } from '@/lib/auth/actions';
import { NotificationBell } from '@/components/notifications/notification-bell';

interface HeaderProps {
  user?: AuthUser | null;
}

function getInitials(name?: string): string {
  if (!name) return 'OX';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function Header({ user }: HeaderProps) {
  const { setMobileOpen } = useSidebar();
  const rolePrefix = `/${(user?.role || 'staff').toLowerCase()}`;

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-1.5 sm:gap-2 border-b bg-background/95 px-2 sm:px-4 backdrop-blur-sm supports-backdrop-filter:bg-background/60">
      {/* Mobile menu trigger */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden min-h-11 min-w-11"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation menu"
      >
        <Menu className="size-5" />
      </Button>

      {/* Mobile branch context badge — visible only on small screens */}
      {user?.branchName && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground truncate max-w-32 sm:max-w-40 lg:hidden">
          <Building2 className="size-3 shrink-0" />
          <span className="truncate">{user.branchName}</span>
        </span>
      )}

      {/* Spacer pushes right-side items */}
      <div className="flex-1" />

      {/* Right side controls */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Search placeholder */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Search"
          className="hidden sm:inline-flex"
        >
          <Search className="size-4" />
        </Button>

        {/* Notifications */}
        {user ? <NotificationBell /> : null}

        {/* Theme toggle (Dark Mode logo) */}
        <ThemeToggle />

        {/* Settings icon next to dark mode */}
        {user ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Link
                  href={`${rolePrefix}/settings`}
                  className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  aria-label="Settings"
                >
                  <SettingsIcon className="size-4" />
                </Link>
              }
            />
            <TooltipContent side="bottom">Settings</TooltipContent>
          </Tooltip>
        ) : null}

        {/* User Account / Profile Link (landing on /profile) */}
        {user ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Link
                  href={`${rolePrefix}/profile`}
                  className="flex items-center gap-2 pl-1.5 pr-2 sm:pr-2.5 h-9 rounded-full hover:bg-muted border border-transparent hover:border-border transition-colors group cursor-pointer"
                  aria-label="View user profile"
                >
                  <div className="relative flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-semibold overflow-hidden">
                    {user.avatarUrl ? (
                      <Image
                        src={user.avatarUrl}
                        alt={user.name}
                        width={28}
                        height={28}
                        className="size-full object-cover"
                        unoptimized
                      />
                    ) : (
                      getInitials(user.name)
                    )}
                  </div>
                  <div className="hidden flex-col text-left sm:flex max-w-36 md:max-w-44">
                    <span className="text-xs font-semibold leading-tight truncate group-hover:text-primary transition-colors">
                      {user.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase leading-tight font-medium mt-0.5 truncate">
                      {user.designation || user.role} {user.branchName ? `• ${user.branchName}` : ''}
                    </span>
                  </div>
                </Link>
              }
            />
            <TooltipContent side="bottom">View Profile</TooltipContent>
          </Tooltip>
        ) : (
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="User profile">
            <UserIcon className="size-4" />
          </Button>
        )}

        {/* Logout button next to name */}
        {user ? (
          <form action={logoutAction} className="inline-flex items-center">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 px-2.5 text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
                    aria-label="Logout"
                  >
                    <LogOut className="size-3.5 shrink-0" />
                    <span className="hidden sm:inline">Logout</span>
                  </Button>
                }
              />
              <TooltipContent side="bottom">Logout</TooltipContent>
            </Tooltip>
          </form>
        ) : null}
      </div>
    </header>
  );
}
