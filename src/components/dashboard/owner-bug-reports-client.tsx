'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Bug,
  Search,
  RotateCw,
  Image as ImageIcon,
  ExternalLink,
  CheckCircle2,
  Clock,
  XCircle,
  User,
  Globe,
  Plus,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BUG_CATEGORIES,
  type BugReportCategory,
  type BugReportStatus,
} from '@/lib/validations/bug-reports';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import type { BugReportListResponse } from '@/lib/bug-reports/service';
import { getOwnerBugReportsAction } from '@/lib/bug-reports/actions';

interface OwnerBugReportsClientProps {
  initialData: BugReportListResponse;
  isOwner?: boolean;
}

export function OwnerBugReportsClient({
  initialData,
  isOwner = true,
}: OwnerBugReportsClientProps) {
  const [data, setData] = useState<BugReportListResponse>(initialData);
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<BugReportStatus | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<BugReportCategory | 'ALL'>('ALL');
  const [page, setPage] = useState(initialData.pagination.page);
  const [pageSize, setPageSize] = useState(initialData.pagination.limit || 15);

  const fetchReports = (overrides?: {
    status?: BugReportStatus | 'ALL';
    category?: BugReportCategory | 'ALL';
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const s = overrides?.status ?? statusFilter;
    const c = overrides?.category ?? categoryFilter;
    const q = overrides?.search !== undefined ? overrides.search : search;
    const p = overrides?.page ?? page;
    const l = overrides?.limit ?? pageSize;

    startTransition(async () => {
      const res = await getOwnerBugReportsAction({
        status: s,
        category: c,
        search: q,
        page: p,
        limit: l,
      });

      if (res.success && res.data) {
        setData(res.data);
      }
    });
  };

  const handleTabChange = (status: BugReportStatus | 'ALL') => {
    setStatusFilter(status);
    setPage(1);
    fetchReports({ status, page: 1 });
  };

  const handleCategoryChange = (cat: string | null) => {
    if (!cat) return;
    const c = cat as BugReportCategory | 'ALL';
    setCategoryFilter(c);
    setPage(1);
    fetchReports({ category: c, page: 1 });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchReports({ page: 1, search });
  };

  const getStatusBadge = (status: BugReportStatus) => {
    switch (status) {
      case 'OPEN':
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1 text-[11px] font-semibold">
            <Clock className="w-3 h-3" /> Open
          </Badge>
        );
      case 'IN_PROGRESS':
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 gap-1 text-[11px] font-semibold">
            <RotateCw className="w-3 h-3 animate-spin" /> In Progress
          </Badge>
        );
      case 'RESOLVED':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 text-[11px] font-semibold">
            <CheckCircle2 className="w-3 h-3" /> Resolved
          </Badge>
        );
      case 'CLOSED':
        return (
          <Badge className="bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30 gap-1 text-[11px] font-semibold">
            <XCircle className="w-3 h-3" /> Closed
          </Badge>
        );
    }
  };

  const getCategoryLabel = (cat: BugReportCategory) => {
    const found = BUG_CATEGORIES.find((c) => c.value === cat);
    return found ? found.label : cat;
  };

  return (
    <div className="space-y-6">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              <Bug className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {isOwner ? 'Customer Bug Reports' : 'My Reported Bugs'}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {isOwner
                  ? 'Technical issues, errors and glitches submitted by customers and guests.'
                  : 'Track the status and resolution notes of issues you have submitted.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            href="/report-bug"
            className={buttonVariants({
              variant: 'default',
              size: 'sm',
              className: 'rounded-xl h-9 gap-1.5 text-xs font-semibold shadow-xs',
            })}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Report a Bug</span>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchReports()}
            disabled={isPending}
            className="rounded-xl h-9 gap-1.5 text-xs font-semibold"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* ─── Status Tabs ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-border/60">
        <button
          onClick={() => handleTabChange('ALL')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 ${
            statusFilter === 'ALL'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
          }`}
        >
          All ({data.stats.total})
        </button>
        <button
          onClick={() => handleTabChange('OPEN')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
            statusFilter === 'OPEN'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
          }`}
        >
          Open
          {data.stats.open > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white font-bold">
              {data.stats.open}
            </span>
          )}
        </button>
        <button
          onClick={() => handleTabChange('IN_PROGRESS')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
            statusFilter === 'IN_PROGRESS'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
          }`}
        >
          In Progress ({data.stats.inProgress})
        </button>
        <button
          onClick={() => handleTabChange('RESOLVED')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
            statusFilter === 'RESOLVED'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
          }`}
        >
          Resolved ({data.stats.resolved})
        </button>
        <button
          onClick={() => handleTabChange('CLOSED')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
            statusFilter === 'CLOSED'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
          }`}
        >
          Closed ({data.stats.closed})
        </button>
      </div>

      {/* ─── Search & Filters Bar ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 w-full relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by reference ID, title, description, or reporter..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-xl text-xs sm:text-sm bg-card"
          />
        </form>

        <div className="w-full sm:w-auto flex items-center gap-2">
          <Select value={categoryFilter} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-full sm:w-48 h-10 rounded-xl text-xs bg-card">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="ALL">All Categories</SelectItem>
              {BUG_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ─── Reports List ─────────────────────────────────────────────────── */}
      <Card className="rounded-2xl border border-border/80 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          {data.reports.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-muted/60 text-muted-foreground mx-auto flex items-center justify-center">
                <Bug className="w-6 h-6 opacity-40" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                {isOwner ? 'No bug reports found' : 'No reported bugs found'}
              </p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {isOwner
                  ? 'No technical issues match your selected filters.'
                  : "You haven't submitted any bug reports matching your filters."}
              </p>
              {!isOwner && (
                <div className="pt-2">
                  <Link
                    href="/report-bug"
                    className={buttonVariants({
                      variant: 'outline',
                      size: 'sm',
                      className: 'rounded-xl h-9 text-xs font-semibold gap-1.5',
                    })}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Report a New Bug</span>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {data.reports.map((report) => (
                <div
                  key={report.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 border border-primary/20">
                      <Bug className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-primary">
                          {report.reportNumber}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">
                          {getCategoryLabel(report.category)}
                        </span>
                        {getStatusBadge(report.status)}
                        {report.screenshotUrl && (
                          <span
                            title="Includes screenshot"
                            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/80 px-2 py-0.5 rounded-md"
                          >
                            <ImageIcon className="w-3 h-3 text-primary" />
                            <span>Attachment</span>
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-foreground truncate">
                        {report.title}
                      </h3>

                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {report.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {report.user ? (
                            <span className="font-medium text-foreground">
                              {report.user.name} (Customer)
                            </span>
                          ) : report.reporterName ? (
                            <span>{report.reporterName} (Guest)</span>
                          ) : (
                            <span>Guest</span>
                          )}
                        </span>

                        <span>•</span>

                        <span>
                          {new Date(report.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>

                        {report.pageUrl && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 truncate max-w-48">
                              <Globe className="w-3 h-3" />
                              <span className="truncate">{report.pageUrl}</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 self-end sm:self-center">
                    <Link
                      href={isOwner ? `/owner/bug-reports/${report.id}` : `/bug-reports/${report.id}`}
                      className={buttonVariants({
                        variant: 'outline',
                        size: 'sm',
                        className: 'rounded-xl h-9 text-xs font-semibold gap-1.5',
                      })}
                    >
                      <span>View Details</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Pagination ───────────────────────────────────────────────────── */}
      <DataTablePagination
        currentPage={data.pagination.page}
        totalPages={data.pagination.totalPages}
        totalItems={data.pagination.total}
        pageSize={pageSize}
        pageSizeOptions={[10, 15, 25, 50]}
        onPageChange={(newPage) => {
          setPage(newPage);
          fetchReports({ page: newPage });
        }}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPage(1);
          fetchReports({ page: 1, limit: newSize });
        }}
        isLoading={isPending}
        itemLabel="reports"
      />
    </div>
  );
}
