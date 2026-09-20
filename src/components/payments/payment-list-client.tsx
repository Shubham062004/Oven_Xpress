'use client';

import { useState, useCallback, useRef, useTransition } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  Search,
  RotateCcw,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Banknote,
  Smartphone,
  Globe,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react';
import { PaymentMethod, PaymentStatus } from '@prisma/client';

import { useAuth } from '@/providers/auth-provider';
import { hasPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getPayments, getPaymentStats } from '@/lib/payments/actions';
import type { PaymentRecord, PaymentStats } from '@/lib/payments/types';
import {
  PAYMENT_METHODS,
  PAYMENT_STATUS_META,
} from '@/lib/payments/constants';

import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

interface BranchOption {
  id: string;
  name: string;
  code: string;
}

interface PaymentListClientProps {
  initialPayments: PaymentRecord[];
  initialStats: PaymentStats;
  initialPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  branches: BranchOption[];
  userBranchId?: string | null;
}

export function PaymentListClient({
  initialPayments,
  initialStats,
  initialPagination,
  branches,
  userBranchId,
}: PaymentListClientProps) {
  const user = useAuth();
  const [, startTransition] = useTransition();

  const [payments, setPayments] = useState<PaymentRecord[]>(initialPayments);
  const [stats, setStats] = useState<PaymentStats>(initialStats);
  const [pagination, setPagination] = useState(initialPagination);
  const [loading, setLoading] = useState(false);

  // Filters state
  const [search, setSearch] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>(userBranchId || 'all');
  const [selectedMethod, setSelectedMethod] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all');

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const canReconcile = hasPermission(user, PERMISSIONS.PAYMENT_RECONCILE);
  const isBranchRestricted = !!userBranchId;

  // Compute date strings based on quick date range selection
  const getDateRangeBounds = (range: string): { startDate?: string; endDate?: string } => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    switch (range) {
      case 'today':
        return { startDate: todayStr, endDate: todayStr };
      case 'yesterday': {
        const y = new Date(today);
        y.setDate(today.getDate() - 1);
        const yStr = y.toISOString().split('T')[0];
        return { startDate: yStr, endDate: yStr };
      }
      case '7days': {
        const d7 = new Date(today);
        d7.setDate(today.getDate() - 7);
        return { startDate: d7.toISOString().split('T')[0], endDate: todayStr };
      }
      case '30days': {
        const d30 = new Date(today);
        d30.setDate(today.getDate() - 30);
        return { startDate: d30.toISOString().split('T')[0], endDate: todayStr };
      }
      default:
        return {};
    }
  };

  const fetchFilteredPayments = useCallback(
    async (
      pageNumber: number = 1,
      searchTerm: string = search,
      branchId: string = selectedBranch,
      method: string = selectedMethod,
      status: string = selectedStatus,
      range: string = dateRange
    ) => {
      setLoading(true);
      try {
        const { startDate, endDate } = getDateRangeBounds(range);

        const [paymentsRes, statsRes] = await Promise.all([
          getPayments({
            page: pageNumber,
            limit: pagination.limit,
            search: searchTerm || undefined,
            branchId: branchId === 'all' ? undefined : branchId,
            method: method === 'all' ? undefined : (method as PaymentMethod),
            status: status === 'all' ? undefined : (status as PaymentStatus),
            startDate,
            endDate,
          }),
          getPaymentStats(
            branchId === 'all' ? undefined : branchId,
            startDate,
            endDate
          ),
        ]);

        if (paymentsRes.success && paymentsRes.data) {
          setPayments(paymentsRes.data.payments);
          setPagination(paymentsRes.data.pagination);
        }

        if (statsRes.success && statsRes.data) {
          setStats(statsRes.data);
        }
      } catch (err) {
        console.error('Failed to filter payments:', err);
      } finally {
        setLoading(false);
      }
    },
    [pagination.limit, search, selectedBranch, selectedMethod, selectedStatus, dateRange]
  );

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      startTransition(() => {
        fetchFilteredPayments(1, value, selectedBranch, selectedMethod, selectedStatus, dateRange);
      });
    }, 350);
  };

  const handleBranchChange = (value: string) => {
    setSelectedBranch(value);
    fetchFilteredPayments(1, search, value, selectedMethod, selectedStatus, dateRange);
  };

  const handleMethodChange = (value: string) => {
    setSelectedMethod(value);
    fetchFilteredPayments(1, search, selectedBranch, value, selectedStatus, dateRange);
  };

  const handleStatusChange = (value: string) => {
    setSelectedStatus(value);
    fetchFilteredPayments(1, search, selectedBranch, selectedMethod, value, dateRange);
  };

  const handleDateRangeChange = (value: string) => {
    setDateRange(value);
    fetchFilteredPayments(1, search, selectedBranch, selectedMethod, selectedStatus, value);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchFilteredPayments(newPage);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Payment Management"
        description="Audit-grade payment ledger, tender transactions, refunds, and daily cash reconciliation."
      >
        <div className="flex items-center gap-2">
          {canReconcile && (
            <Link
              href="/payments/reconciliation"
              className={buttonVariants({ variant: 'outline', className: 'gap-2 shadow-xs' })}
            >
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              Daily Reconciliation
            </Link>
          )}
        </div>
      </PageHeader>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {/* Total Payments */}
        <Card className="border shadow-xs col-span-2 sm:col-span-1 lg:col-span-1">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5 text-primary" />
              Total Successful
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-foreground">
              ₹{stats.totalSuccessfulPayments.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {stats.totalSuccessfulPayments.count} payment{stats.totalSuccessfulPayments.count === 1 ? '' : 's'}
            </p>
          </CardContent>
        </Card>

        {/* Cash */}
        <Card className="border shadow-xs">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Banknote className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              Cash
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              ₹{stats.cash.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {stats.cash.count} transaction{stats.cash.count === 1 ? '' : 's'}
            </p>
          </CardContent>
        </Card>

        {/* UPI */}
        <Card className="border shadow-xs">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              UPI
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
              ₹{stats.upi.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {stats.upi.count} transaction{stats.upi.count === 1 ? '' : 's'}
            </p>
          </CardContent>
        </Card>

        {/* Card */}
        <Card className="border shadow-xs">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              Card
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
              ₹{stats.card.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {stats.card.count} transaction{stats.card.count === 1 ? '' : 's'}
            </p>
          </CardContent>
        </Card>

        {/* Online / Other */}
        <Card className="border shadow-xs">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              Online / Other
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
              ₹{(stats.online.amount + stats.other.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {stats.online.count + stats.other.count} transaction{(stats.online.count + stats.other.count) === 1 ? '' : 's'}
            </p>
          </CardContent>
        </Card>

        {/* Refunded */}
        <Card className="border shadow-xs">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              Refunded
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
              ₹{stats.refunded.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {stats.refunded.count} refund{stats.refunded.count === 1 ? '' : 's'}
            </p>
          </CardContent>
        </Card>

        {/* Failed */}
        <Card className="border shadow-xs">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[11px] font-semibold text-destructive uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-destructive">
              {stats.failed.count}
            </div>
            <p className="text-[11px] text-muted-foreground">
              ₹0 in ledger (audited)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Search Toolbar */}
      <Card className="border shadow-xs">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            {/* Search Input */}
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search payment #, order #, reference..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Branch Filter */}
            {!isBranchRestricted && (
              <Select value={selectedBranch} onValueChange={(v) => v && handleBranchChange(v)}>
                <SelectTrigger className="w-full">
                  <div className="flex items-center gap-2 truncate">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <SelectValue placeholder="All Branches" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Method Filter */}
            <Select value={selectedMethod} onValueChange={(v) => v && handleMethodChange(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Tender Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tender Types</SelectItem>
                {(Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map((m) => (
                  <SelectItem key={m} value={m}>
                    {PAYMENT_METHODS[m].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={selectedStatus} onValueChange={(v) => v && handleStatusChange(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {(Object.keys(PAYMENT_STATUS_META) as PaymentStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {PAYMENT_STATUS_META[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date Range Quick Filter */}
            <Select value={dateRange} onValueChange={(v) => v && handleDateRangeChange(v)}>
              <SelectTrigger className="w-full">
                <div className="flex items-center gap-2 truncate">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="All Time" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="7days">Last 7 Days</SelectItem>
                <SelectItem value="30days">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Ledger Table (Desktop) & Cards (Mobile) */}
      <Card className="border shadow-xs">
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton rows={8} />
          ) : payments.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icon={CreditCard}
                title="No Payments Found"
                description="No payment transactions match your selected search criteria or date filters."
              />
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment #</TableHead>
                      <TableHead>Order #</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Reference / Auth</TableHead>
                      <TableHead>Processed By</TableHead>
                      <TableHead className="text-right">Date & Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => {
                      const MethodIcon = PAYMENT_METHODS[p.method]?.icon || CreditCard;
                      const statusMeta = PAYMENT_STATUS_META[p.status];

                      return (
                        <TableRow key={p.id} className="hover:bg-muted/40 transition-colors">
                          <TableCell className="font-bold text-foreground">
                            {p.paymentNumber}
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/orders/${p.orderId}`}
                              className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                            >
                              {p.orderNumber}
                              <ExternalLink className="h-3 w-3 opacity-60" />
                            </Link>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium text-foreground">{p.branchName}</span>
                            <span className="text-xs text-muted-foreground block">{p.branchCode}</span>
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-muted/60 text-foreground">
                              <MethodIcon className="h-3.5 w-3.5 text-muted-foreground" />
                              {PAYMENT_METHODS[p.method]?.label}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${statusMeta.className}`}
                            >
                              {statusMeta.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={`font-bold block ${
                                p.status === PaymentStatus.FAILED
                                  ? 'line-through text-muted-foreground'
                                  : 'text-foreground'
                              }`}
                            >
                              ₹{p.amount.toFixed(2)}
                            </span>
                            {p.refundedAmount > 0 && (
                              <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium block">
                                Ref: ₹{p.refundedAmount.toFixed(2)}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">
                            {p.referenceNumber || '—'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {p.processedBy}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(p.processedAt).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden divide-y">
                {payments.map((p) => {
                  const MethodIcon = PAYMENT_METHODS[p.method]?.icon || CreditCard;
                  const statusMeta = PAYMENT_STATUS_META[p.status];

                  return (
                    <div key={p.id} className="p-4 space-y-2.5">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-bold text-sm text-foreground block">
                            {p.paymentNumber}
                          </span>
                          <Link
                            href={`/orders/${p.orderId}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline mt-0.5"
                          >
                            Order: {p.orderNumber}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </div>
                        <div className="text-right">
                          <span
                            className={`text-base font-bold block ${
                              p.status === PaymentStatus.FAILED ? 'line-through text-muted-foreground' : 'text-foreground'
                            }`}
                          >
                            ₹{p.amount.toFixed(2)}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${statusMeta.className}`}
                          >
                            {statusMeta.label}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
                        <span className="inline-flex items-center gap-1">
                          <MethodIcon className="h-3.5 w-3.5" />
                          {PAYMENT_METHODS[p.method]?.label}
                        </span>
                        <span>{p.branchName}</span>
                        <span>{new Date(p.processedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center justify-between p-4 border-t bg-muted/10 text-xs">
                <span className="text-muted-foreground">
                  Showing {payments.length} of {pagination.total} transaction{pagination.total === 1 ? '' : 's'}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page <= 1 || loading}
                    className="h-8 gap-1"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Previous
                  </Button>
                  <span className="font-medium text-foreground px-2">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages || loading}
                    className="h-8 gap-1"
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
