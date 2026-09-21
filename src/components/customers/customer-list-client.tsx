'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users,
  Search,
  Plus,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  Eye,
  Edit2,
  Receipt,
  IndianRupee,
  Star,
  ShoppingBag,
} from 'lucide-react';
import { toast } from 'sonner';

import type { CustomerListItem, CustomerStatus, PaginationMeta } from '@/lib/customers/types';
import { toggleCustomerStatus } from '@/lib/customers/actions';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { useAuth } from '@/providers/auth-provider';
import { hasPermission } from '@/lib/permissions/check';

import { PageHeader } from '@/components/ui/page-header';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CustomerDialog } from '@/components/customers/customer-dialog';

interface CustomerListClientProps {
  initialCustomers: CustomerListItem[];
  initialPagination: PaginationMeta;
  branches: Array<{ id: string; name: string; city: string }>;
  currentBranchId?: string;
  currentStatus?: CustomerStatus;
  currentSearch?: string;
}

export function CustomerListClient({
  initialCustomers,
  initialPagination,
  branches,
  currentBranchId = '',
  currentStatus,
  currentSearch = '',
}: CustomerListClientProps) {
  const router = useRouter();
  const authUser = useAuth();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(currentSearch);
  const [branchFilter, setBranchFilter] = useState(currentBranchId);
  const [statusFilter, setStatusFilter] = useState<string>(currentStatus || '');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerListItem | null>(null);

  const canCreate = hasPermission(authUser, PERMISSIONS.CUSTOMER_CREATE);
  const canUpdate = hasPermission(authUser, PERMISSIONS.CUSTOMER_UPDATE);
  const canDeactivate = hasPermission(authUser, PERMISSIONS.CUSTOMER_DEACTIVATE);

  const applyFilters = (newBranch?: string, newStatus?: string, newSearch?: string) => {
    const params = new URLSearchParams();
    const b = newBranch !== undefined ? newBranch : branchFilter;
    const s = newStatus !== undefined ? newStatus : statusFilter;
    const q = newSearch !== undefined ? newSearch : search;

    if (b) params.set('branchId', b);
    if (s) params.set('status', s);
    if (q.trim()) params.set('search', q.trim());

    startTransition(() => {
      router.push(`/customers?${params.toString()}`);
    });
  };

  const resetFilters = () => {
    setSearch('');
    setBranchFilter('');
    setStatusFilter('');
    startTransition(() => {
      router.push('/customers');
    });
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams();
    if (branchFilter) params.set('branchId', branchFilter);
    if (statusFilter) params.set('status', statusFilter);
    if (search.trim()) params.set('search', search.trim());
    params.set('page', newPage.toString());

    startTransition(() => {
      router.push(`/customers?${params.toString()}`);
    });
  };

  const handleToggleStatus = (customer: CustomerListItem) => {
    const nextStatus = customer.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const actionLabel = nextStatus === 'ACTIVE' ? 'activate' : 'deactivate';

    if (
      !confirm(
        `Are you sure you want to ${actionLabel} ${customer.name}? All historical orders and feedback will remain intact.`
      )
    ) {
      return;
    }

    startTransition(async () => {
      const res = await toggleCustomerStatus(customer.id);

      if (res.success) {
        toast.success(`Customer ${customer.name} marked as ${nextStatus}`);
        router.refresh();
      } else {
        toast.error(res.error || `Failed to ${actionLabel} customer`);
      }
    });
  };

  // Lifetime summaries from currently paginated items
  const totalInPage = initialCustomers.length;
  const activeInPage = initialCustomers.filter((c) => c.status === 'ACTIVE').length;
  const totalOrdersInPage = initialCustomers.reduce((acc, c) => acc + c.totalOrders, 0);
  const totalSpendInPage = initialCustomers.reduce((acc, c) => acc + c.totalSpend, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Management"
        description="View customer profiles, order history, lifetime spending, and loyalty status across all branches."
      >
        <div className="flex items-center gap-2">
          {canCreate && (
            <Button
              size="sm"
              onClick={() => {
                setEditingCustomer(null);
                setIsCreateOpen(true);
              }}
              className="gap-1.5"
            >
              <Plus className="size-4" />
              Add Customer
            </Button>
          )}
        </div>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Total Customers</p>
            <Users className="size-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight">
            {initialPagination.total}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Registered customer profiles
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Active Profiles</p>
            <UserCheck className="size-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {activeInPage} / {totalInPage}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Active on current page
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Page Orders</p>
            <ShoppingBag className="size-4 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight">
            {totalOrdersInPage}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Combined orders for page list
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Page Spend</p>
            <IndianRupee className="size-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight">
            ₹{totalSpendInPage.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Successful settled spend
          </p>
        </Card>
      </div>

      {/* Navigation Sub-Links */}
      <div className="flex flex-wrap items-center gap-2 border-b pb-3">
        <Link
          href="/customers"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm"
        >
          <Users className="size-3.5" />
          Customer Directory
        </Link>
        <Link
          href="/reviews"
          className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Star className="size-3.5" />
          Reviews & Moderation
        </Link>
        <Link
          href="/feedback"
          className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Receipt className="size-3.5" />
          Feedback Dashboard
        </Link>
      </div>

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyFilters(branchFilter, statusFilter, search);
                }}
                className="pl-9"
              />
            </div>

            {/* Branch Filter */}
            {branches.length > 1 && (
              <select
                value={branchFilter}
                onChange={(e) => {
                  setBranchFilter(e.target.value);
                  applyFilters(e.target.value, statusFilter, search);
                }}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.city})
                  </option>
                ))}
              </select>
            )}

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                applyFilters(branchFilter, e.target.value, search);
              }}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyFilters()}
              disabled={isPending}
            >
              Filter
            </Button>
            {(search || branchFilter || statusFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="gap-1 text-muted-foreground"
              >
                <RotateCcw className="size-3.5" />
                Reset
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Customers Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3 text-center">Total Orders</th>
                  <th className="px-4 py-3 text-right">Total Spend</th>
                  <th className="px-4 py-3">Last Order</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {initialCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground">
                      <Users className="mx-auto size-9 opacity-30 mb-2" />
                      <p className="text-base font-semibold">No customers found</p>
                      <p className="text-xs">
                        Try adjusting your search criteria or register a new customer profile.
                      </p>
                    </td>
                  </tr>
                ) : (
                  initialCustomers.map((cust) => (
                    <tr key={cust.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        <Link
                          href={`/customers/${cust.id}`}
                          className="hover:text-primary hover:underline"
                        >
                          {cust.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                        {cust.phone || cust.maskedPhone || '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {cust.email || cust.maskedEmail || '—'}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold">
                        {cust.totalOrders}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        ₹{cust.totalSpend.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {cust.lastOrderDate
                          ? new Date(cust.lastOrderDate).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : 'Never'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant="secondary"
                          className={
                            cust.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold text-[11px]'
                              : 'bg-muted text-muted-foreground font-semibold text-[11px]'
                          }
                        >
                          {cust.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/customers/${cust.id}`}
                            className={buttonVariants({
                              variant: 'ghost',
                              size: 'sm',
                              className: 'h-8 px-2 text-xs',
                            })}
                          >
                            <Eye className="size-3.5 mr-1" />
                            View
                          </Link>

                          {canUpdate && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs"
                              onClick={() => {
                                setEditingCustomer(cust);
                                setIsCreateOpen(true);
                              }}
                            >
                              <Edit2 className="size-3.5 mr-1" />
                              Edit
                            </Button>
                          )}

                          {canDeactivate && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-8 px-2 text-xs ${
                                cust.status === 'ACTIVE'
                                  ? 'text-rose-600 hover:text-rose-700 dark:text-rose-400'
                                  : 'text-emerald-600 hover:text-emerald-700 dark:text-emerald-400'
                              }`}
                              onClick={() => handleToggleStatus(cust)}
                              disabled={isPending}
                            >
                              {cust.status === 'ACTIVE' ? (
                                <>
                                  <UserX className="size-3.5 mr-1" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <UserCheck className="size-3.5 mr-1" />
                                  Activate
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {initialPagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Showing{' '}
                <span className="font-medium">
                  {(initialPagination.page - 1) * initialPagination.pageSize + 1}
                </span>{' '}
                to{' '}
                <span className="font-medium">
                  {Math.min(
                    initialPagination.page * initialPagination.pageSize,
                    initialPagination.total
                  )}
                </span>{' '}
                of <span className="font-medium">{initialPagination.total}</span> customers
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(initialPagination.page - 1)}
                  disabled={initialPagination.page <= 1 || isPending}
                  className="gap-1 h-8"
                >
                  <ChevronLeft className="size-3.5" />
                  Previous
                </Button>
                <span className="text-xs font-medium">
                  {initialPagination.page} / {initialPagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(initialPagination.page + 1)}
                  disabled={
                    initialPagination.page >= initialPagination.totalPages || isPending
                  }
                  className="gap-1 h-8"
                >
                  Next
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Create / Edit Dialog */}
      <CustomerDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        customer={editingCustomer}
      />
    </div>
  );
}
