'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Receipt,
  Plus,
  Search,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  FileSpreadsheet,
  Layers,
  Repeat,
  RotateCcw,
  Paperclip,
  ChevronLeft,
  ChevronRight,
  Eye,
  Check,
  Ban,
  Filter,
} from 'lucide-react';
import { ExpenseStatus } from '@prisma/client';

import type {
  ExpenseListItem,
  ExpenseStats,
  PaginationMeta,
} from '@/lib/expenses/types';
import {
  EXPENSE_STATUS_META,
  EXPENSE_PAYMENT_METHOD_META,
  formatINR,
} from '@/lib/expenses/constants';
import { PERMISSIONS } from '@/lib/permissions/definitions';

import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { ExpenseCreateDialog } from './expense-create-dialog';
import { ExpenseApprovalDialog } from './expense-approval-dialog';
import { ExpenseCancelDialog } from './expense-cancel-dialog';

interface BranchOption {
  id: string;
  name: string;
  code: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

interface ExpenseListClientProps {
  initialExpenses: ExpenseListItem[];
  initialPagination: PaginationMeta;
  initialStats: ExpenseStats;
  branches: BranchOption[];
  categories: CategoryOption[];
  defaultBranchId: string;
  userBranchId?: string | null;
  userPermissions: string[];
}

export function ExpenseListClient({
  initialExpenses,
  initialPagination,
  initialStats,
  branches,
  categories,
  defaultBranchId,
  userBranchId,
  userPermissions,
}: ExpenseListClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [approvalTarget, setApprovalTarget] = useState<{
    expense: ExpenseListItem;
    mode: 'approve' | 'reject';
  } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ExpenseListItem | null>(null);

  // Filters
  const [branchFilter, setBranchFilter] = useState<string>(
    userBranchId || defaultBranchId || 'all'
  );
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [page, setPage] = useState<number>(initialPagination.page);

  const isBranchRestricted = !!userBranchId;

  // Permissions check
  const canCreate = userPermissions.includes(PERMISSIONS.EXPENSE_CREATE);
  const canApprove = userPermissions.includes(PERMISSIONS.EXPENSE_APPROVE);
  const canReject = userPermissions.includes(PERMISSIONS.EXPENSE_REJECT);
  const canCancel = userPermissions.includes(PERMISSIONS.EXPENSE_CANCEL);
  const canViewCategories = userPermissions.includes(PERMISSIONS.EXPENSE_CATEGORY_READ);
  const canViewTemplates = userPermissions.includes(PERMISSIONS.EXPENSE_TEMPLATE_READ);

  const handleApplyFilters = () => {
    const params = new URLSearchParams();
    if (branchFilter && branchFilter !== 'all') params.set('branchId', branchFilter);
    if (categoryFilter && categoryFilter !== 'all') params.set('categoryId', categoryFilter);
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
    if (methodFilter && methodFilter !== 'all') params.set('paymentMethod', methodFilter);
    if (search.trim()) params.set('search', search.trim());
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (page > 1) params.set('page', String(page));

    startTransition(() => {
      router.push(`/expenses?${params.toString()}`);
    });
  };

  const handleResetFilters = () => {
    setBranchFilter(userBranchId || defaultBranchId || 'all');
    setCategoryFilter('all');
    setStatusFilter('all');
    setMethodFilter('all');
    setSearch('');
    setStartDate('');
    setEndDate('');
    setPage(1);

    startTransition(() => {
      router.push('/expenses');
    });
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    const params = new URLSearchParams(window.location.search);
    params.set('page', String(newPage));
    startTransition(() => {
      router.push(`/expenses?${params.toString()}`);
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Expenses & Expenditure Ledger"
          description="Track categorized operational expenses, manage approval workflows, attach receipt proofs, and review branch expenditure."
        />
        <div className="flex items-center gap-2 flex-wrap">
          {canViewTemplates && (
            <Link href="/expenses/templates">
              <Button variant="outline" size="sm" className="gap-1.5 h-9">
                <Repeat className="h-4 w-4" />
                <span>Recurring Templates</span>
              </Button>
            </Link>
          )}
          {canViewCategories && (
            <Link href="/expenses/categories">
              <Button variant="outline" size="sm" className="gap-1.5 h-9">
                <Layers className="h-4 w-4" />
                <span>Categories</span>
              </Button>
            </Link>
          )}
          {canCreate && (
            <Button
              size="sm"
              className="gap-1.5 h-9"
              onClick={() => setIsCreateOpen(true)}
            >
              <Plus className="h-4 w-4" />
              <span>Record Expense</span>
            </Button>
          )}
        </div>
      </div>

      {/* 5 KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
        {/* Today */}
        <Card className="border shadow-xs">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-blue-500" />
              Today&apos;s Expenses
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold tracking-tight text-foreground">
              {formatINR(initialStats.todayTotal)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {initialStats.todayCount} records today
            </p>
          </CardContent>
        </Card>

        {/* This Month */}
        <Card className="border shadow-xs">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <FileSpreadsheet className="h-3.5 w-3.5 text-indigo-500" />
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold tracking-tight text-foreground">
              {formatINR(initialStats.monthTotal)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {initialStats.monthCount} approved records
            </p>
          </CardContent>
        </Card>

        {/* Pending Approval */}
        <Card className="border shadow-xs border-amber-500/20 bg-amber-500/5">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Pending Approval
              </span>
              {initialStats.pendingCount > 0 && (
                <Badge variant="secondary" className="bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[10px] px-1.5 py-0 h-4">
                  {initialStats.pendingCount}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold tracking-tight text-amber-900 dark:text-amber-300">
              {formatINR(initialStats.pendingTotal)}
            </div>
            <p className="text-[11px] text-amber-700/80 dark:text-amber-400 mt-0.5">
              Requires authorization
            </p>
          </CardContent>
        </Card>

        {/* Approved Expenses */}
        <Card className="border shadow-xs">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Approved Total
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold tracking-tight text-foreground">
              {formatINR(initialStats.approvedTotal)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {initialStats.approvedCount} verified entries
            </p>
          </CardContent>
        </Card>

        {/* Top Category */}
        <Card className="border shadow-xs col-span-2 md:col-span-1">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Receipt className="h-3.5 w-3.5 text-purple-500" />
              Top Category
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {initialStats.topCategories[0] ? (
              <div>
                <div className="text-sm font-bold truncate text-foreground">
                  {initialStats.topCategories[0].categoryName}
                </div>
                <div className="text-xs text-muted-foreground flex items-center justify-between mt-0.5">
                  <span>{formatINR(initialStats.topCategories[0].amount)}</span>
                  <span className="font-semibold text-primary">
                    {initialStats.topCategories[0].percentage}%
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">No categorized spend yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filter & Search Toolbar */}
      <Card className="border shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {/* Search */}
            <div className="lg:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search EXP #, vendor, description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* Branch Selector */}
            <div>
              <Select
                value={branchFilter}
                onValueChange={(val) => {
                  if (val) setBranchFilter(val);
                }}
                disabled={isBranchRestricted}
              >
                <SelectTrigger className="h-9 text-xs w-full">
                  <div className="flex items-center gap-1.5 truncate">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <SelectValue placeholder="All Branches" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category Selector */}
            <div>
              <Select
                value={categoryFilter}
                onValueChange={(val) => {
                  if (val) setCategoryFilter(val);
                }}
              >
                <SelectTrigger className="h-9 text-xs w-full">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div>
              <Select
                value={statusFilter}
                onValueChange={(val) => {
                  if (val) setStatusFilter(val);
                }}
              >
                <SelectTrigger className="h-9 text-xs w-full">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {Object.entries(EXPENSE_STATUS_META).map(([key, meta]) => (
                    <SelectItem key={key} value={key}>
                      {meta.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payment Method Filter */}
            <div>
              <Select
                value={methodFilter}
                onValueChange={(val) => {
                  if (val) setMethodFilter(val);
                }}
              >
                <SelectTrigger className="h-9 text-xs w-full">
                  <SelectValue placeholder="All Tender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tender</SelectItem>
                  {Object.entries(EXPENSE_PAYMENT_METHOD_META).map(([key, meta]) => (
                    <SelectItem key={key} value={key}>
                      {meta.shortLabel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date Range & Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 border-t border-border/60">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Date:</span>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 text-xs w-36"
                placeholder="From"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 text-xs w-36"
                placeholder="To"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={handleResetFilters}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={handleApplyFilters}
                disabled={isPending}
              >
                <Filter className="h-3.5 w-3.5" />
                Apply Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expenses Table (Desktop) & Cards (Mobile) */}
      <Card className="border shadow-xs">
        <CardContent className="p-0">
          {initialExpenses.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="p-3 rounded-full bg-muted/60 w-fit mx-auto">
                <Receipt className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground">No Expenses Found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                No expense entries match your current search and filter settings. Try adjusting your filters or record a new expense.
              </p>
              {canCreate && (
                <Button
                  size="sm"
                  className="mt-2"
                  onClick={() => setIsCreateOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Record Expense
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[140px]">Expense #</TableHead>
                      <TableHead className="w-[100px]">Date</TableHead>
                      <TableHead className="w-[130px]">Branch</TableHead>
                      <TableHead className="w-[140px]">Category</TableHead>
                      <TableHead>Description & Vendor</TableHead>
                      <TableHead className="w-[110px]">Tender</TableHead>
                      <TableHead className="w-[120px] text-right">Amount</TableHead>
                      <TableHead className="w-[130px] text-center">Status</TableHead>
                      <TableHead className="w-[120px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {initialExpenses.map((exp) => {
                      const statusMeta = EXPENSE_STATUS_META[exp.status];
                      const methodMeta = EXPENSE_PAYMENT_METHOD_META[exp.paymentMethod];
                      const isPendingItem = exp.status === ExpenseStatus.PENDING_APPROVAL;
                      const isDraftItem = exp.status === ExpenseStatus.DRAFT;

                      return (
                        <TableRow key={exp.id} className="group">
                          {/* Expense # */}
                          <TableCell className="font-mono text-xs font-semibold">
                            <div className="flex items-center gap-1.5">
                              <Link
                                href={`/expenses/${exp.id}`}
                                className="text-primary hover:underline"
                              >
                                {exp.expenseNumber}
                              </Link>
                              {exp.receiptUrl && (
                                <span title="Receipt attached">
                                  <Paperclip className="h-3 w-3 text-muted-foreground" />
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Date */}
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {exp.expenseDate}
                          </TableCell>

                          {/* Branch */}
                          <TableCell className="text-xs">
                            <div className="truncate max-w-[120px]" title={exp.branchName}>
                              {exp.branchName}
                            </div>
                          </TableCell>

                          {/* Category */}
                          <TableCell>
                            <Badge variant="outline" className="text-[11px] font-normal py-0 truncate max-w-[130px]">
                              {exp.categoryName}
                            </Badge>
                          </TableCell>

                          {/* Description & Vendor */}
                          <TableCell className="text-xs">
                            <div className="font-medium text-foreground truncate max-w-[220px]">
                              {exp.description}
                            </div>
                            {exp.vendorName && (
                              <div className="text-[11px] text-muted-foreground truncate max-w-[220px]">
                                Vendor: {exp.vendorName}
                              </div>
                            )}
                          </TableCell>

                          {/* Payment Method */}
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {methodMeta?.shortLabel || exp.paymentMethod}
                          </TableCell>

                          {/* Amount */}
                          <TableCell className="text-xs font-bold text-foreground text-right whitespace-nowrap">
                            {formatINR(exp.amount)}
                          </TableCell>

                          {/* Status */}
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={`text-[11px] font-medium py-0.5 ${statusMeta.badgeClass}`}
                            >
                              {statusMeta.label}
                            </Badge>
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Link href={`/expenses/${exp.id}`}>
                                <Button variant="ghost" size="icon" className="h-7 w-7" title="View details">
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </Link>

                              {isPendingItem && canApprove && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                                  title="Approve"
                                  onClick={() => setApprovalTarget({ expense: exp, mode: 'approve' })}
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </Button>
                              )}

                              {isPendingItem && canReject && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                  title="Reject"
                                  onClick={() => setApprovalTarget({ expense: exp, mode: 'reject' })}
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </Button>
                              )}

                              {(isDraftItem || isPendingItem) && canCancel && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-amber-600 hover:bg-amber-500/10"
                                  title="Cancel expense"
                                  onClick={() => setCancelTarget(exp)}
                                >
                                  <Ban className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-border">
                {initialExpenses.map((exp) => {
                  const statusMeta = EXPENSE_STATUS_META[exp.status];
                  const methodMeta = EXPENSE_PAYMENT_METHOD_META[exp.paymentMethod];
                  const isPendingItem = exp.status === ExpenseStatus.PENDING_APPROVAL;
                  const isDraftItem = exp.status === ExpenseStatus.DRAFT;

                  return (
                    <div key={exp.id} className="p-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/expenses/${exp.id}`}
                            className="font-mono text-sm font-bold text-primary"
                          >
                            {exp.expenseNumber}
                          </Link>
                          {exp.receiptUrl && <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />}
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-medium py-0.5 ${statusMeta.badgeClass}`}
                        >
                          {statusMeta.label}
                        </Badge>
                      </div>

                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-muted-foreground">{exp.categoryName}</span>
                        <span className="text-base font-bold text-foreground">
                          {formatINR(exp.amount)}
                        </span>
                      </div>

                      <p className="text-xs text-foreground font-medium line-clamp-2">
                        {exp.description}
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                        <span>{exp.branchName} • {exp.expenseDate}</span>
                        <span>{methodMeta?.shortLabel}</span>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Link href={`/expenses/${exp.id}`}>
                          <Button variant="outline" size="sm" className="h-7 text-xs">
                            Details
                          </Button>
                        </Link>
                        {isPendingItem && canApprove && (
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => setApprovalTarget({ expense: exp, mode: 'approve' })}
                          >
                            Approve
                          </Button>
                        )}
                        {isPendingItem && canReject && (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setApprovalTarget({ expense: exp, mode: 'reject' })}
                          >
                            Reject
                          </Button>
                        )}
                        {(isDraftItem || isPendingItem) && canCancel && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs text-amber-600 border-amber-500/30"
                            onClick={() => setCancelTarget(exp)}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {initialPagination.totalPages > 1 && (
                <div className="p-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                  <div>
                    Page {initialPagination.page} of {initialPagination.totalPages} ({initialPagination.total} total expenses)
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      disabled={initialPagination.page <= 1 || isPending}
                      onClick={() => handlePageChange(initialPagination.page - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      disabled={initialPagination.page >= initialPagination.totalPages || isPending}
                      onClick={() => handlePageChange(initialPagination.page + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Record Expense Dialog */}
      <ExpenseCreateDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        branches={branches}
        categories={categories}
        defaultBranchId={defaultBranchId}
        userBranchId={userBranchId}
        onSuccess={() => {
          startTransition(() => {
            router.refresh();
          });
        }}
      />

      {/* Approval / Rejection Dialog */}
      {approvalTarget && (
        <ExpenseApprovalDialog
          open={!!approvalTarget}
          onOpenChange={(open) => !open && setApprovalTarget(null)}
          mode={approvalTarget.mode}
          expense={{
            id: approvalTarget.expense.id,
            expenseNumber: approvalTarget.expense.expenseNumber,
            amount: approvalTarget.expense.amount,
            categoryName: approvalTarget.expense.categoryName,
            branchName: approvalTarget.expense.branchName,
            description: approvalTarget.expense.description,
          }}
          onSuccess={() => {
            startTransition(() => {
              router.refresh();
            });
          }}
        />
      )}

      {/* Cancel Dialog */}
      {cancelTarget && (
        <ExpenseCancelDialog
          open={!!cancelTarget}
          onOpenChange={(open) => !open && setCancelTarget(null)}
          expense={{
            id: cancelTarget.id,
            expenseNumber: cancelTarget.expenseNumber,
            amount: cancelTarget.amount,
            categoryName: cancelTarget.categoryName,
            branchName: cancelTarget.branchName,
            description: cancelTarget.description,
          }}
          onSuccess={() => {
            startTransition(() => {
              router.refresh();
            });
          }}
        />
      )}
    </div>
  );
}
