'use client';

import React from 'react';
import Link from 'next/link';
import {
  Shield,
  Users,
  Building2,
  ScrollText,
  Settings,
  PlusCircle,
  ArrowRight,
  UserCheck,
  CheckCircle2,
  Activity,
} from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { AdminDashboardData } from '@/lib/reports/admin-dashboard-service';

interface AdminDashboardClientProps {
  data: AdminDashboardData;
}

export function AdminDashboardClient({ data }: AdminDashboardClientProps) {
  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border bg-linear-to-r from-blue-500/10 via-background to-indigo-500/5 p-6 md:p-8">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-semibold text-xs text-primary">
                System Administration
              </Badge>
              <span className="text-muted-foreground">•</span>
              <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="size-3" />
                All Systems Operational
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              System Admin Console
            </h1>
            <p className="text-sm text-muted-foreground">
              User role governance, branch infrastructure, security auditing, and system config.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin/users"
              className={buttonVariants({ size: 'lg', className: 'gap-2 shadow-md' })}
            >
              <PlusCircle className="size-4" />
              Manage Users
            </Link>
            <Link
              href="/admin/audit-logs"
              className={buttonVariants({ variant: 'outline', size: 'lg', className: 'gap-2' })}
            >
              <ScrollText className="size-4" />
              Security Logs
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Admin KPI Strip */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">System Users</span>
            <Users className="size-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {data.metrics.activeUsers}{' '}
            <span className="text-sm font-normal text-muted-foreground">
              / {data.metrics.totalUsers}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Active verified accounts
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Branch Outlets</span>
            <Building2 className="size-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {data.metrics.activeBranches}{' '}
            <span className="text-sm font-normal text-muted-foreground">
              / {data.metrics.totalBranches}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Active restaurant locations
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Registered Staff</span>
            <UserCheck className="size-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {data.metrics.totalEmployees}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Total employee directory
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Audit Events</span>
            <Activity className="size-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {data.metrics.auditEventsCount}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Security audit log entries
          </div>
        </div>
      </div>

      {/* 3. Administration Shortcuts */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">
          Administrative Modules
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Link
            href="/admin/users"
            className="group flex flex-col items-center justify-center rounded-xl border bg-card p-3.5 text-center transition-all hover:border-primary/50 hover:bg-primary/5"
          >
            <Shield className="size-5 text-primary group-hover:scale-110 transition-transform" />
            <span className="mt-2 text-xs font-semibold">User Accounts</span>
          </Link>
          <Link
            href="/admin/branches"
            className="group flex flex-col items-center justify-center rounded-xl border bg-card p-3.5 text-center transition-all hover:border-primary/50 hover:bg-primary/5"
          >
            <Building2 className="size-5 text-indigo-500 group-hover:scale-110 transition-transform" />
            <span className="mt-2 text-xs font-semibold">Branches</span>
          </Link>
          <Link
            href="/admin/employees"
            className="group flex flex-col items-center justify-center rounded-xl border bg-card p-3.5 text-center transition-all hover:border-primary/50 hover:bg-primary/5"
          >
            <Users className="size-5 text-amber-500 group-hover:scale-110 transition-transform" />
            <span className="mt-2 text-xs font-semibold">Employees</span>
          </Link>
          <Link
            href="/admin/attendance"
            className="group flex flex-col items-center justify-center rounded-xl border bg-card p-3.5 text-center transition-all hover:border-primary/50 hover:bg-primary/5"
          >
            <UserCheck className="size-5 text-emerald-500 group-hover:scale-110 transition-transform" />
            <span className="mt-2 text-xs font-semibold">Attendance</span>
          </Link>
          <Link
            href="/admin/audit-logs"
            className="group flex flex-col items-center justify-center rounded-xl border bg-card p-3.5 text-center transition-all hover:border-primary/50 hover:bg-primary/5"
          >
            <ScrollText className="size-5 text-rose-500 group-hover:scale-110 transition-transform" />
            <span className="mt-2 text-xs font-semibold">Audit Logs</span>
          </Link>
          <Link
            href="/admin/settings"
            className="group flex flex-col items-center justify-center rounded-xl border bg-card p-3.5 text-center transition-all hover:border-primary/50 hover:bg-primary/5"
          >
            <Settings className="size-5 text-slate-500 group-hover:scale-110 transition-transform" />
            <span className="mt-2 text-xs font-semibold">Settings</span>
          </Link>
        </div>
      </div>

      {/* 4. Split: Recent User Accounts & Audit Trail */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* User Accounts */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b px-5 py-3.5">
            <h3 className="text-sm font-semibold text-foreground">
              Recent System Users
            </h3>
            <Link
              href="/admin/users"
              className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'gap-1 text-xs' })}
            >
              View All
              <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <div className="divide-y">
            {data.recentUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between px-5 py-3 text-sm"
              >
                <div className="space-y-0.5">
                  <div className="font-semibold text-foreground">{user.name}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-medium">
                    {user.roleName}
                  </Badge>
                  <Badge
                    variant={user.isActive ? 'default' : 'secondary'}
                    className="text-[10px]"
                  >
                    {user.isActive ? 'ACTIVE' : 'INACTIVE'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Audit Log Stream */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b px-5 py-3.5">
            <div className="flex items-center gap-2">
              <ScrollText className="size-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                Recent Security Audit Logs
              </h3>
            </div>
            <Link
              href="/admin/audit-logs"
              className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'gap-1 text-xs' })}
            >
              View Logs
              <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <div className="divide-y">
            {data.recentAuditLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between px-5 py-3 text-sm"
              >
                <div className="space-y-0.5 max-w-sm">
                  <div className="font-medium text-foreground truncate">
                    {log.description}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    By {log.userName} • {log.createdAt}
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] uppercase font-mono">
                  {log.action}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
