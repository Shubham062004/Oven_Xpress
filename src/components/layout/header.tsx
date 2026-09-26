'use client';

import {
  Building2,
  Lock,
  LogOut,
  Menu,
  Search,
  Settings as SettingsIcon,
  Sliders,
  User as UserIcon,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

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
                  className="flex items-center gap-2 pl-1.5 pr-2.5 h-9 rounded-full hover:bg-accent border border-transparent hover:border-border transition-colors"
                  aria-label="User account menu"
                />
              }
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
                <span className="text-xs font-semibold leading-tight truncate">{user.name}</span>
                <span className="text-[10px] text-muted-foreground uppercase leading-tight font-medium mt-0.5 truncate">
                  {user.designation || user.role} {user.branchName ? `• ${user.branchName}` : ''}
                </span>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 max-w-[calc(100vw-2rem)] p-2">
              <DropdownMenuLabel className="font-normal px-2 py-1.5">
                <div className="flex flex-col space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-sm font-semibold overflow-hidden border">
                      {user.avatarUrl ? (
                        <Image
                          src={user.avatarUrl}
                          alt={user.name}
                          width={40}
                          height={40}
                          className="size-full object-cover"
                          unoptimized
                        />
                      ) : (
                        getInitials(user.name)
                      )}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-tight truncate">{user.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <Badge variant={getRoleVariant(user.role)} className="text-[10px] px-1.5 py-0 font-medium">
                      {user.role}
                    </Badge>
                    {user.branchName ? (
                      <span className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                        <Building2 className="size-3 shrink-0" />
                        <span className="truncate">{user.branchName}</span>
                      </span>
                    ) : user.role === 'OWNER' || user.role === 'ADMIN' ? (
                      <span className="text-[11px] text-muted-foreground">Universal Access</span>
                    ) : null}
                  </div>
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator className="my-1.5" />

              <DropdownMenuItem render={<Link href="/profile" className="flex items-center gap-2.5 w-full cursor-pointer px-2 py-1.5 rounded-md" />}>
                <UserIcon className="size-4 text-muted-foreground" />
                <span className="text-sm">Profile</span>
              </DropdownMenuItem>

              <DropdownMenuItem render={<Link href="/profile?tab=account" className="flex items-center gap-2.5 w-full cursor-pointer px-2 py-1.5 rounded-md" />}>
                <SettingsIcon className="size-4 text-muted-foreground" />
                <span className="text-sm">Account Settings</span>
              </DropdownMenuItem>

              <DropdownMenuItem render={<Link href="/profile/password" className="flex items-center gap-2.5 w-full cursor-pointer px-2 py-1.5 rounded-md" />}>
                <Lock className="size-4 text-muted-foreground" />
                <span className="text-sm">Change Password</span>
              </DropdownMenuItem>

              <DropdownMenuItem render={<Link href="/profile?tab=preferences" className="flex items-center gap-2.5 w-full cursor-pointer px-2 py-1.5 rounded-md" />}>
                <Sliders className="size-4 text-muted-foreground" />
                <span className="text-sm">Preferences</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1.5" />

              <form action={logoutAction} className="w-full">
                <button
                  type="submit"
                  className="relative flex w-full cursor-pointer select-none items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-destructive outline-none transition-colors hover:bg-destructive/10 focus:bg-destructive/10 font-medium"
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
