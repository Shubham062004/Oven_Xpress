'use client';

import { LogOut, Menu, Search, Settings as SettingsIcon, Shield, User as UserIcon } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

  const getRoleVariant = (role?: string) => {
    switch (role) {
      case 'OWNER':
        return 'default';
      case 'ADMIN':
        return 'secondary';
      case 'MANAGER':
        return 'outline';
      default:
        return 'outline';
    }
  };

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur-sm supports-backdrop-filter:bg-background/60">
      {/* Mobile menu trigger */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation menu"
      >
        <Menu className="size-5" />
      </Button>

      {/* Spacer pushes right-side items */}
      <div className="flex-1" />

      {/* Right side controls */}
      <div className="flex items-center gap-2">
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

        {/* Theme toggle */}
        <ThemeToggle />

        {/* User Account Menu */}
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 pl-2 pr-3 h-9 rounded-full hover:bg-accent"
                  aria-label="User menu"
                />
              }
            >
              <div className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-semibold">
                {getInitials(user.name)}
              </div>
              <div className="hidden flex-col text-left sm:flex">
                <span className="text-xs font-semibold leading-none">{user.name}</span>
                <span className="text-[10px] text-muted-foreground uppercase leading-tight font-medium mt-0.5">
                  {user.role}
                </span>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold leading-none">{user.name}</p>
                    <Badge variant={getRoleVariant(user.role)} className="text-[10px] px-1.5 py-0">
                      {user.role}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-none truncate">
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link href="/" className="flex items-center gap-2 w-full cursor-pointer" />}>
                <Shield className="size-4" />
                <span>Dashboard</span>
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/settings" className="flex items-center gap-2 w-full cursor-pointer" />}>
                <SettingsIcon className="size-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <form action={logoutAction} className="w-full">
                <button
                  type="submit"
                  className="relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive outline-none transition-colors hover:bg-destructive/10 focus:bg-destructive/10"
                >
                  <LogOut className="size-4" />
                  <span>Sign out</span>
                </button>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="User profile">
            <UserIcon className="size-4" />
          </Button>
        )}
      </div>
    </header>
  );
}
