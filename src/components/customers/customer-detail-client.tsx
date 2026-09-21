'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  ShoppingBag,
  IndianRupee,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  Star,
  AlertCircle,
  ChevronLeft,
  Edit2,
  UserX,
  UserCheck,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';

import type {
  CustomerDetail,
  CustomerListItem,
  CustomerIssueItem,
  CustomerOrderRow,
  ReviewItem,
} from '@/lib/customers/types';
import { toggleCustomerStatus } from '@/lib/customers/actions';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { useAuth } from '@/providers/auth-provider';
import { hasPermission } from '@/lib/permissions/check';

import { PageHeader } from '@/components/ui/page-header';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CustomerDialog } from '@/components/customers/customer-dialog';
import { IssueDialog } from '@/components/customers/issue-dialog';
import { IssueActionDialog } from '@/components/customers/issue-action-dialog';
import { ReviewDialog } from '@/components/customers/review-dialog';

interface CustomerDetailClientProps {
  data: CustomerDetail;
  branches: Array<{ id: string; name: string }>;
}

export function CustomerDetailClient({ data, branches }: CustomerDetailClientProps) {
  const router = useRouter();
  const authUser = useAuth();
  const [isPending, startTransition] = useTransition();

  const { summary, orders, reviews, issues, ...customer } = data;

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isIssueDialogOpen, setIsIssueDialogOpen] = useState(false);
  const [selectedOrderForIssue, setSelectedOrderForIssue] = useState<{
    id: string;
    number: string;
    branchId: string;
  } | null>(null);

  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [selectedOrderForReview, setSelectedOrderForReview] = useState<{
    id: string;
    number: string;
    branchId: string;
    branchName: string;
  } | null>(null);

  // For issue status/assign/resolve dialogs
  const [activeIssueAction, setActiveIssueAction] = useState<{
    issue: CustomerIssueItem;
    mode: 'STATUS' | 'ASSIGN' | 'RESOLVE';
  } | null>(null);

  const canUpdate = hasPermission(authUser, PERMISSIONS.CUSTOMER_UPDATE);
  const canDeactivate = hasPermission(authUser, PERMISSIONS.CUSTOMER_DEACTIVATE);
  const canLogIssue = hasPermission(authUser, PERMISSIONS.ISSUE_CREATE);
  const canResolveIssue = hasPermission(authUser, PERMISSIONS.ISSUE_RESOLVE);
  const canAssignIssue = hasPermission(authUser, PERMISSIONS.ISSUE_ASSIGN);

  const handleToggleStatus = () => {
    const nextStatus = customer.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const actionLabel = nextStatus === 'ACTIVE' ? 'activate' : 'deactivate';

    if (
      !confirm(
        `Are you sure you want to ${actionLabel} ${customer.name}? All historical orders and feedback remain preserved.`
      )
    ) {
      return;
    }

    startTransition(async () => {
      const res = await toggleCustomerStatus(customer.id);

      if (res.success) {
        toast.success(`Customer marked as ${nextStatus}`);
        router.refresh();
      } else {
        toast.error(res.error || `Failed to ${actionLabel} customer`);
      }
    });
  };

  const customerItemCompat: CustomerListItem = {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    maskedPhone: null,
    email: customer.email,
    maskedEmail: null,
    address: customer.address,
    notes: customer.notes,
    status: customer.status,
    totalOrders: summary.totalOrders,
    totalSpend: summary.totalSpend,
    lastOrderDate: summary.lastOrderDate,
    createdAt: customer.createdAt,
  };

  return (
    <div className="space-y-6">
      {/* Back button & PageHeader */}
      <div className="flex items-center gap-2">
        <Link
          href="/customers"
          className={buttonVariants({
            variant: 'outline',
            size: 'sm',
            className: 'gap-1.5 h-8',
          })}
        >
          <ChevronLeft className="size-4" />
          Back to Customers
        </Link>
      </div>

      <PageHeader
        title={customer.name}
        description={`Customer profile registered on ${new Date(
          customer.createdAt
        ).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}`}
      >
        <div className="flex items-center gap-2">
          {canLogIssue && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedOrderForIssue(null);
                setIsIssueDialogOpen(true);
              }}
              className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/40"
            >
              <AlertCircle className="size-4" />
              Log Complaint
            </Button>
          )}

          {canUpdate && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditDialogOpen(true)}
              className="gap-1.5"
            >
              <Edit2 className="size-4" />
              Edit Profile
            </Button>
          )}

          {canDeactivate && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleStatus}
              disabled={isPending}
              className={`gap-1.5 ${
                customer.status === 'ACTIVE'
                  ? 'text-rose-600 hover:text-rose-700 dark:text-rose-400'
                  : 'text-emerald-600 hover:text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {customer.status === 'ACTIVE' ? (
                <>
                  <UserX className="size-4" />
                  Deactivate
                </>
              ) : (
                <>
                  <UserCheck className="size-4" />
                  Activate
                </>
              )}
            </Button>
          )}
        </div>
      </PageHeader>

      {/* Top Section: Profile Details Card & Order Summary KPIs */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Customer Profile Card */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <User className="size-4 text-primary" />
                Customer Information
              </CardTitle>
              <Badge
                variant="secondary"
                className={
                  customer.status === 'ACTIVE'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-muted text-muted-foreground'
                }
              >
                {customer.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3.5 text-sm">
            <div className="flex items-center gap-2.5">
              <Phone className="size-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Phone Number</p>
                <p className="font-mono font-medium">{customer.phone || 'Not provided'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Mail className="size-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Email Address</p>
                <p className="font-medium">{customer.email || 'Not provided'}</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <MapPin className="size-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Delivery / Street Address</p>
                <p className="font-medium leading-snug">{customer.address || 'Not provided'}</p>
              </div>
            </div>

            {customer.notes && (
              <div className="flex items-start gap-2.5 rounded-md bg-muted/40 p-2.5">
                <FileText className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">
                    Preferences / Notes
                  </p>
                  <p className="text-xs leading-relaxed mt-0.5">{customer.notes}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lifetime Order Summary KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 lg:col-span-2">
          <Card className="p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Total Orders</span>
              <ShoppingBag className="size-4 text-primary" />
            </div>
            <div className="mt-2">
              <p className="text-2xl font-bold">{summary.totalOrders}</p>
              <p className="text-[11px] text-muted-foreground">Lifetime transactions</p>
            </div>
          </Card>

          <Card className="p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Completed</span>
              <CheckCircle2 className="size-4 text-emerald-500" />
            </div>
            <div className="mt-2">
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {summary.completedOrders}
              </p>
              <p className="text-[11px] text-muted-foreground">Successfully fulfilled</p>
            </div>
          </Card>

          <Card className="p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Cancelled</span>
              <XCircle className="size-4 text-rose-500" />
            </div>
            <div className="mt-2">
              <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                {summary.cancelledOrders}
              </p>
              <p className="text-[11px] text-muted-foreground">Voided or cancelled</p>
            </div>
          </Card>

          <Card className="p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Total Spend</span>
              <IndianRupee className="size-4 text-amber-500" />
            </div>
            <div className="mt-2">
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                ₹{summary.totalSpend.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-muted-foreground">Settled payments only</p>
            </div>
          </Card>

          <Card className="p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Average Order Value</span>
              <TrendingUp className="size-4 text-blue-500" />
            </div>
            <div className="mt-2">
              <p className="text-2xl font-bold">
                ₹{summary.averageOrderValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-muted-foreground">Per completed order</p>
            </div>
          </Card>

          <Card className="p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Last Order Date</span>
              <Clock className="size-4 text-purple-500" />
            </div>
            <div className="mt-2">
              <p className="text-sm font-bold truncate">
                {summary.lastOrderDate
                  ? new Date(summary.lastOrderDate).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })
                  : 'Never'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {summary.lastOrderDate
                  ? new Date(summary.lastOrderDate).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'No orders placed'}
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Tabs: Order History, Reviews, Complaints & Issues */}
      <Tabs defaultValue="orders" className="space-y-4">
        <TabsList>
          <TabsTrigger value="orders" className="gap-2">
            <ShoppingBag className="size-4" />
            Historical Orders ({orders.length})
          </TabsTrigger>
          <TabsTrigger value="reviews" className="gap-2">
            <Star className="size-4" />
            Reviews & Feedback ({reviews.length})
          </TabsTrigger>
          <TabsTrigger value="issues" className="gap-2">
            <AlertCircle className="size-4" />
            Customer Issues ({issues.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Orders */}
        <TabsContent value="orders">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Order History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Order Number</th>
                      <th className="px-4 py-3">Branch</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3 text-right">Amount (Historical)</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-muted-foreground text-xs">
                          No historical orders found for this customer profile.
                        </td>
                      </tr>
                    ) : (
                      orders.map((o: CustomerOrderRow) => (
                        <tr key={o.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 font-semibold font-mono text-xs">
                            <Link
                              href={`/orders/${o.id}`}
                              className="hover:text-primary hover:underline"
                            >
                              {o.orderNumber}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {o.branchName}
                          </td>
                          <td className="px-4 py-3 text-xs font-medium">
                            <Badge variant="outline" className="text-[10px]">
                              {o.orderType}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">
                            ₹{o.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge
                              variant="secondary"
                              className={
                                o.status === 'COMPLETED'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px]'
                                  : o.status === 'CANCELLED'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 text-[10px]'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-[10px]'
                              }
                            >
                              {o.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {new Date(o.createdAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-[11px] gap-1 text-amber-600 hover:text-amber-700"
                                onClick={() => {
                                  setSelectedOrderForReview({
                                    id: o.id,
                                    number: o.orderNumber,
                                    branchId: o.branchId,
                                    branchName: o.branchName,
                                  });
                                  setIsReviewDialogOpen(true);
                                }}
                              >
                                <Star className="size-3" />
                                Review
                              </Button>

                              {canLogIssue && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-[11px] gap-1 text-rose-600 hover:text-rose-700"
                                  onClick={() => {
                                    setSelectedOrderForIssue({
                                      id: o.id,
                                      number: o.orderNumber,
                                      branchId: o.branchId,
                                    });
                                    setIsIssueDialogOpen(true);
                                  }}
                                >
                                  <AlertCircle className="size-3" />
                                  Complaint
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Reviews & Feedback */}
        <TabsContent value="reviews">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Customer Reviews & Ratings</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Rating</th>
                      <th className="px-4 py-3">Review & Comments</th>
                      <th className="px-4 py-3">Branch</th>
                      <th className="px-4 py-3">Order</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {reviews.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted-foreground text-xs">
                          No reviews or ratings logged for this customer.
                        </td>
                      </tr>
                    ) : (
                      reviews.map((rev: ReviewItem) => (
                        <tr key={rev.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 whitespace-nowrap font-medium">
                            <div className="flex items-center gap-1">
                              <Star className="size-4 fill-amber-400 text-amber-500" />
                              <span className="font-bold">{rev.rating}</span>
                              <span className="text-xs text-muted-foreground">/ 5</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {rev.title && (
                              <p className="font-semibold text-xs text-foreground mb-0.5">
                                {rev.title}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground italic">
                              {rev.comment ? `"${rev.comment}"` : '(Rating only, no written comment)'}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {rev.branchName}
                          </td>
                          <td className="px-4 py-3 text-xs font-mono whitespace-nowrap">
                            {rev.orderNumber || '—'}
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <Badge
                              variant="secondary"
                              className={
                                rev.status === 'PUBLISHED'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px]'
                                  : rev.status === 'PENDING'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px]'
                                  : rev.status === 'RESOLVED'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-[10px]'
                                  : 'bg-muted text-muted-foreground text-[10px]'
                              }
                            >
                              {rev.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(rev.createdAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Customer Issues / Complaints */}
        <TabsContent value="issues">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Operational Complaints & Incidents</CardTitle>
              {canLogIssue && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedOrderForIssue(null);
                    setIsIssueDialogOpen(true);
                  }}
                  className="gap-1 text-xs h-8"
                >
                  <Plus className="size-3.5" />
                  Log New Incident
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Issue #</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Priority</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Assigned Staff</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {issues.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-muted-foreground text-xs">
                          No operational issues or complaints logged for this customer.
                        </td>
                      </tr>
                    ) : (
                      issues.map((iss: CustomerIssueItem) => (
                        <tr key={iss.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 font-mono font-semibold text-xs whitespace-nowrap">
                            {iss.issueNumber}
                          </td>
                          <td className="px-4 py-3 text-xs font-medium whitespace-nowrap">
                            <Badge variant="outline" className="text-[10px]">
                              {iss.type.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <Badge
                              variant="secondary"
                              className={
                                iss.priority === 'URGENT'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-bold text-[10px]'
                                  : iss.priority === 'HIGH'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px]'
                                  : 'bg-muted text-muted-foreground text-[10px]'
                              }
                            >
                              {iss.priority}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 max-w-70">
                            <p className="text-xs text-foreground truncate font-medium">
                              {iss.description}
                            </p>
                            {iss.resolutionNote && (
                              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">
                                Resolution: {iss.resolutionNote}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {iss.assignedStaffName ? (
                              <span className="font-medium text-foreground">
                                {iss.assignedStaffName}
                              </span>
                            ) : (
                              <span className="italic">Unassigned</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <Badge
                              variant="secondary"
                              className={
                                iss.status === 'RESOLVED' || iss.status === 'CLOSED'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px]'
                                  : iss.status === 'IN_PROGRESS'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-[10px]'
                                  : iss.status === 'CANCELLED'
                                  ? 'bg-muted text-muted-foreground text-[10px]'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px]'
                              }
                            >
                              {iss.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {canResolveIssue &&
                                iss.status !== 'RESOLVED' &&
                                iss.status !== 'CLOSED' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-[11px] text-emerald-600 hover:text-emerald-700"
                                    onClick={() =>
                                      setActiveIssueAction({
                                        issue: iss,
                                        mode: 'RESOLVE',
                                      })
                                    }
                                  >
                                    Resolve
                                  </Button>
                                )}

                              {canAssignIssue && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-[11px]"
                                  onClick={() =>
                                    setActiveIssueAction({
                                      issue: iss,
                                      mode: 'ASSIGN',
                                    })
                                  }
                                >
                                  Assign
                                </Button>
                              )}

                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-[11px]"
                                onClick={() =>
                                  setActiveIssueAction({
                                    issue: iss,
                                    mode: 'STATUS',
                                  })
                                }
                              >
                                Status
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Customer Dialog */}
      <CustomerDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        customer={customerItemCompat}
      />

      {/* Log Issue Dialog */}
      <IssueDialog
        open={isIssueDialogOpen}
        onOpenChange={setIsIssueDialogOpen}
        customerId={customer.id}
        customerName={customer.name}
        orderId={selectedOrderForIssue?.id}
        orderNumber={selectedOrderForIssue?.number}
        branchId={selectedOrderForIssue?.branchId}
        branches={branches}
      />

      {/* Submit Review Dialog */}
      <ReviewDialog
        open={isReviewDialogOpen}
        onOpenChange={setIsReviewDialogOpen}
        customerId={customer.id}
        customerName={customer.name}
        orderId={selectedOrderForReview?.id}
        orderNumber={selectedOrderForReview?.number}
        branchId={selectedOrderForReview?.branchId || branches[0]?.id || ''}
        branchName={
          selectedOrderForReview?.branchName || branches[0]?.name || ''
        }
      />

      {/* Issue Status/Assign/Resolve Action Dialog */}
      <IssueActionDialog
        open={!!activeIssueAction}
        onOpenChange={(open) => {
          if (!open) setActiveIssueAction(null);
        }}
        issue={activeIssueAction?.issue || null}
        mode={activeIssueAction?.mode || 'STATUS'}
      />
    </div>
  );
}
