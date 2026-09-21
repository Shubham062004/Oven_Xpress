'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShieldAlert,
  Search,
  Calendar,
  Building2,
  Printer,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RotateCcw,
  Activity,
  UserCheck,
  Zap,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { exportAuditLogsCSVAction } from '@/lib/audit/actions';
import type {
  AuditLogListItem,
  AuditSummaryStats,
  AuditPaginationMeta,
  AuditDatePreset,
} from '@/lib/audit/audit-types';

interface AuditLogsClientProps {
  rows: AuditLogListItem[];
  summary: AuditSummaryStats;
  pagination: AuditPaginationMeta;
  branches: Array<{ id: string; name: string; code: string }>;
  actionTypes: string[];
  entityTypes: string[];
  selectedBranchId: string;
  isBranchRestricted: boolean;
  selectedPreset: string;
  startDate?: string;
  endDate?: string;
  selectedAction?: string;
  selectedEntity?: string;
  currentSearch?: string;
  canExport?: boolean;
}

export function AuditLogsClient({
  rows,
  summary,
  pagination,
  branches,
  actionTypes,
  entityTypes,
  selectedBranchId,
  isBranchRestricted,
  selectedPreset,
  startDate,
  endDate,
  selectedAction = 'all',
  selectedEntity = 'all',
  currentSearch = '',
  canExport = true,
}: AuditLogsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(currentSearch);
  const [customStart, setCustomStart] = useState(startDate || '');
  const [customEnd, setCustomEnd] = useState(endDate || '');
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const updateFilters = (newParams: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    Object.entries(newParams).forEach(([key, val]) => {
      if (!val || val === 'all') {
        params.delete(key);
      } else {
        params.set(key, val);
      }
    });
    params.set('page', '1');
    startTransition(() => {
      router.push(`/audit-logs?${params.toString()}`);
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ search });
  };

  const handleResetFilters = () => {
    setSearch('');
    setCustomStart('');
    setCustomEnd('');
    startTransition(() => {
      router.push('/audit-logs');
    });
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('page', String(newPage));
    startTransition(() => {
      router.push(`/audit-logs?${params.toString()}`);
    });
  };

  const handleExportCSV = async () => {
    try {
      setIsExporting(true);
      setExportError(null);

      const res = await exportAuditLogsCSVAction({
        search: currentSearch || undefined,
        branchId: selectedBranchId !== 'all' ? selectedBranchId : undefined,
        action: selectedAction !== 'all' ? selectedAction : undefined,
        entityType: selectedEntity !== 'all' ? selectedEntity : undefined,
        preset: selectedPreset as AuditDatePreset,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      if (!res.success || !res.data) {
        setExportError(res.error || 'Failed to export CSV');
        return;
      }

      const blob = new Blob([res.data.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', res.data.filename || `audit-logs-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const getActionBadgeColor = (action: string) => {
    if (action.startsWith('AUTH_')) {
      return 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800';
    }
    if (action.includes('CREATE') || action.includes('APPROVE') || action.includes('RECEIVE')) {
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    }
    if (action.includes('UPDATE') || action.includes('TRANSFER') || action.includes('STATUS')) {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    }
    if (action.includes('ADJUST') || action.includes('WASTAGE')) {
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    }
    if (
      action.includes('CANCEL') ||
      action.includes('REJECT') ||
      action.includes('REFUND') ||
      action.includes('DEACTIVATE') ||
      action.includes('DELETE')
    ) {
      return 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    }
    return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700';
  };

  const formatDateTime = (isoString: string) => {
    const d = new Date(isoString);
    return {
      date: d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      time: d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }),
    };
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-primary" />
              Audit Logs & System Activity
            </h1>
            <Badge variant="outline" className="text-xs font-semibold uppercase bg-primary/10 text-primary border-primary/20">
              Append-Only Ledger
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Tamper-resistant audit trail of administrative, financial, order, and inventory operations.
          </p>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="flex items-center gap-1.5"
            title="Print audit ledger"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </Button>

          {canExport && (
            <Button
              variant="default"
              size="sm"
              onClick={handleExportCSV}
              disabled={isExporting || rows.length === 0}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
              title="Export filtered records to CSV"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
            </Button>
          )}
        </div>
      </div>

      {exportError && (
        <div className="p-3 text-sm text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-lg border border-rose-200 dark:border-rose-800">
          {exportError}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/50 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Audited Events</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {summary.totalLogs.toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Matching current scope</p>
            </div>
            <div className="p-2.5 rounded-full bg-primary/10 text-primary">
              <Activity className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Active Actors</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {summary.uniqueActors.toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Authenticated operators</p>
            </div>
            <div className="p-2.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <UserCheck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Tracked Branches</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {summary.uniqueBranches.toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Branch locations in range</p>
            </div>
            <div className="p-2.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Building2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Top Action Type</p>
              <p className="text-base font-bold text-foreground mt-1 truncate max-w-44" title={summary.topAction}>
                {summary.topAction ? summary.topAction.replace(/_/g, ' ') : 'N/A'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Most frequent mutation</p>
            </div>
            <div className="p-2.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Zap className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="border-border/60 shadow-xs print:hidden">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Search Input */}
            <div className="lg:col-span-2">
              <form onSubmit={handleSearchSubmit} className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search description, entity ID, actor..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 text-sm"
                />
              </form>
            </div>

            {/* Date Preset */}
            <div>
              <Select
                value={selectedPreset}
                onValueChange={(val) => updateFilters({ preset: val })}
              >
                <SelectTrigger className="text-sm">
                  <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="custom">Custom Date Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Branch Filter */}
            <div>
              <Select
                value={selectedBranchId}
                disabled={isBranchRestricted}
                onValueChange={(val) => updateFilters({ branchId: val })}
              >
                <SelectTrigger className="text-sm">
                  <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent>
                  {!isBranchRestricted && <SelectItem value="all">All Branches</SelectItem>}
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Action Filter */}
            <div>
              <Select
                value={selectedAction}
                onValueChange={(val) => updateFilters({ action: val })}
              >
                <SelectTrigger className="text-sm">
                  <Zap className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {actionTypes.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Entity Filter */}
            <div>
              <Select
                value={selectedEntity}
                onValueChange={(val) => updateFilters({ entityType: val })}
              >
                <SelectTrigger className="text-sm">
                  <Layers className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="All Entities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entities</SelectItem>
                  {entityTypes.map((entity) => (
                    <SelectItem key={entity} value={entity}>
                      {entity}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Custom Date Picker (when custom is selected) */}
          {selectedPreset === 'custom' && (
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/40">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Start:</span>
                <Input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-40 h-8 text-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">End:</span>
                <Input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-40 h-8 text-xs"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() =>
                  updateFilters({
                    startDate: customStart || null,
                    endDate: customEnd || null,
                  })
                }
              >
                Apply Custom Range
              </Button>
            </div>
          )}

          {/* Reset Filters / Active indicator */}
          {(currentSearch ||
            selectedAction !== 'all' ||
            selectedEntity !== 'all' ||
            selectedPreset !== 'today' ||
            (!isBranchRestricted && selectedBranchId !== 'all')) && (
            <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
              <span>Filtered by active criteria</span>
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1 text-primary hover:underline font-medium"
              >
                <RotateCcw className="w-3 h-3" />
                Reset all filters
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <div className="rounded-lg border border-border/60 bg-card overflow-hidden shadow-xs">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="w-40 text-xs font-semibold">Timestamp</TableHead>
              <TableHead className="w-40 text-xs font-semibold">Actor</TableHead>
              <TableHead className="w-40 text-xs font-semibold">Action</TableHead>
              <TableHead className="w-36 text-xs font-semibold">Entity</TableHead>
              <TableHead className="w-36 text-xs font-semibold">Branch</TableHead>
              <TableHead className="text-xs font-semibold">Description</TableHead>
              <TableHead className="w-24 text-right text-xs font-semibold print:hidden">Inspect</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-44 text-center">
                  <div className="flex flex-col items-center justify-center space-y-2 text-muted-foreground">
                    <ShieldAlert className="w-8 h-8 stroke-1 text-muted-foreground/60" />
                    <p className="text-sm font-medium">No audit log records found</p>
                    <p className="text-xs text-muted-foreground">
                      No operational activities recorded matching the selected filter criteria.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const { date, time } = formatDateTime(row.createdAt);
                return (
                  <TableRow key={row.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="text-xs whitespace-nowrap py-3">
                      <div className="font-medium text-foreground">{time}</div>
                      <div className="text-[11px] text-muted-foreground">{date}</div>
                    </TableCell>

                    <TableCell className="text-xs py-3">
                      {row.actorName ? (
                        <div>
                          <div className="font-semibold text-foreground truncate max-w-36">
                            {row.actorName}
                          </div>
                          <Badge variant="outline" className="text-[10px] py-0 px-1 font-normal uppercase bg-muted/60 text-muted-foreground">
                            {row.actorRole || 'User'}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-xs italic text-muted-foreground">System</span>
                      )}
                    </TableCell>

                    <TableCell className="text-xs py-3">
                      <Badge
                        variant="outline"
                        className={`text-[11px] font-mono font-medium px-2 py-0.5 border ${getActionBadgeColor(
                          row.action
                        )}`}
                      >
                        {row.action}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-xs py-3">
                      <div>
                        <span className="font-semibold text-foreground text-xs">{row.entityType}</span>
                        {row.entityId && (
                          <div className="font-mono text-[10px] text-muted-foreground truncate max-w-32" title={row.entityId}>
                            #{row.entityId.slice(-8)}
                          </div>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="text-xs py-3">
                      {row.branchName ? (
                        <div className="truncate max-w-32" title={row.branchName}>
                          <span className="font-medium text-foreground">{row.branchName}</span>
                          <span className="text-[10px] text-muted-foreground block">
                            {row.branchCode || ''}
                          </span>
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          Global System
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground py-3">
                      <p className="line-clamp-2 leading-relaxed text-foreground/90">{row.description}</p>
                    </TableCell>

                    <TableCell className="text-right text-xs py-3 print:hidden">
                      <Link
                        href={`/audit-logs/${row.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors p-1"
                        title="Inspect full audit record"
                      >
                        Inspect
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Server-side Pagination Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-border/40 bg-muted/10 print:hidden">
          <div className="text-xs text-muted-foreground">
            Showing{' '}
            <span className="font-medium text-foreground">
              {pagination.total > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0}
            </span>{' '}
            to{' '}
            <span className="font-medium text-foreground">
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </span>{' '}
            of <span className="font-medium text-foreground">{pagination.total.toLocaleString()}</span> entries
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1 || isPending}
              className="h-8 text-xs flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </Button>

            <span className="text-xs text-muted-foreground px-2">
              Page {pagination.page} of {pagination.totalPages || 1}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || isPending}
              className="h-8 text-xs flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
