'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Receipt,
  Building2,
  Calendar,
  CreditCard,
  Tag,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  User,
  ShieldCheck,
  FileText,
  ExternalLink,
  Repeat,
  History,
  Ban,
  Plus,
} from 'lucide-react';

import type { ExpenseDetail } from '@/lib/expenses/types';
import {
  EXPENSE_STATUS_META,
  EXPENSE_PAYMENT_METHOD_META,
  formatINR,
} from '@/lib/expenses/constants';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { ExpenseStatus } from '@prisma/client';

import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';

import { ExpenseApprovalDialog } from './expense-approval-dialog';
import { ExpenseCancelDialog } from './expense-cancel-dialog';
import { ExpenseCreateDialog } from './expense-create-dialog';

interface ExpenseDetailClientProps {
  expense: ExpenseDetail;
  userPermissions: string[];
  branches: Array<{ id: string; name: string; code: string }>;
  categories: Array<{ id: string; name: string }>;
  userBranchId?: string | null;
}

export function ExpenseDetailClient({
  expense,
  userPermissions,
  branches,
  categories,
  userBranchId,
}: ExpenseDetailClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [approvalTarget, setApprovalTarget] = useState<'approve' | 'reject' | null>(null);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isCreateCopyOpen, setIsCreateCopyOpen] = useState(false);

  const statusMeta = EXPENSE_STATUS_META[expense.status];
  const methodMeta = EXPENSE_PAYMENT_METHOD_META[expense.paymentMethod];

  const canApprove = userPermissions.includes(PERMISSIONS.EXPENSE_APPROVE);
  const canReject = userPermissions.includes(PERMISSIONS.EXPENSE_REJECT);
  const canCancel = userPermissions.includes(PERMISSIONS.EXPENSE_CANCEL);
  const canCreate = userPermissions.includes(PERMISSIONS.EXPENSE_CREATE);

  const isPending = expense.status === ExpenseStatus.PENDING_APPROVAL;
  const isDraft = expense.status === ExpenseStatus.DRAFT;
  const isApproved = expense.status === ExpenseStatus.APPROVED;
  const isRejected = expense.status === ExpenseStatus.REJECTED;
  const isCancelled = expense.status === ExpenseStatus.CANCELLED;

  const isPdf = expense.receiptUrl?.toLowerCase().endsWith('.pdf');

  return (
    <div className="space-y-6">
      {/* Back Link & Header */}
      <div className="space-y-2">
        <Link
          href="/expenses"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Expenses</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <PageHeader
            title={`Expense ${expense.expenseNumber}`}
            description={`Recorded on ${expense.expenseDate} at ${expense.branchName}.`}
          />
          <div className="flex items-center gap-2 flex-wrap">
            {isPending && canApprove && (
              <Button
                size="sm"
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => setApprovalTarget('approve')}
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Approve Expense</span>
              </Button>
            )}

            {isPending && canReject && (
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5"
                onClick={() => setApprovalTarget('reject')}
              >
                <XCircle className="h-4 w-4" />
                <span>Reject</span>
              </Button>
            )}

            {(isDraft || isPending) && canCancel && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
                onClick={() => setIsCancelOpen(true)}
              >
                <Ban className="h-4 w-4" />
                <span>Cancel Expense</span>
              </Button>
            )}

            {isRejected && canCreate && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setIsCreateCopyOpen(true)}
              >
                <Plus className="h-4 w-4" />
                <span>Record Corrected Expense</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Status Notice Banner */}
      <div
        className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isApproved
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-950 dark:text-emerald-300'
            : isRejected
            ? 'bg-red-500/10 border-red-500/20 text-red-950 dark:text-red-300'
            : isPending
            ? 'bg-amber-500/10 border-amber-500/20 text-amber-950 dark:text-amber-300'
            : isCancelled
            ? 'bg-stone-500/10 border-stone-500/20 text-stone-950 dark:text-stone-300'
            : 'bg-muted/60 border-border text-foreground'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            {isApproved && <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
            {isRejected && <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />}
            {isPending && <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
            {isCancelled && <Ban className="h-5 w-5 text-stone-600 dark:text-stone-400" />}
            {isDraft && <Receipt className="h-5 w-5 text-muted-foreground" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-wide">Status: {statusMeta.label}</span>
              <Badge variant="outline" className={`text-[10px] py-0 ${statusMeta.badgeClass}`}>
                {statusMeta.label}
              </Badge>
            </div>
            <p className="text-xs opacity-90 mt-0.5">{statusMeta.description}</p>
          </div>
        </div>

        {isApproved && (
          <div className="text-xs text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5 shrink-0">
            <ShieldCheck className="h-4 w-4" />
            <span>Immutable Financial Record</span>
          </div>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Financial Details, Notes, Receipt */}
        <div className="lg:col-span-2 space-y-6">
          {/* Core Financial Card */}
          <Card className="border shadow-xs">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-primary" />
                  Financial Summary
                </CardTitle>
                <div className="text-2xl font-black tracking-tight text-foreground">
                  {formatINR(expense.amount)}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Expense Category</span>
                  <div className="mt-1">
                    <Badge variant="secondary" className="font-medium text-xs">
                      <Tag className="h-3 w-3 mr-1" />
                      {expense.categoryName}
                    </Badge>
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground block text-[11px]">Branch Location</span>
                  <div className="mt-1 font-semibold text-foreground flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{expense.branchName} ({expense.branchCode})</span>
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground block text-[11px]">Business Date</span>
                  <div className="mt-1 font-semibold text-foreground flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{expense.expenseDate}</span>
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground block text-[11px]">Payment Method</span>
                  <div className="mt-1 font-semibold text-foreground flex items-center gap-1">
                    <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{methodMeta?.label || expense.paymentMethod}</span>
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground block text-[11px]">Reference / UTR #</span>
                  <span className="mt-1 font-mono text-foreground block">
                    {expense.referenceNumber || 'None provided'}
                  </span>
                </div>

                <div>
                  <span className="text-muted-foreground block text-[11px]">Vendor / Payee</span>
                  <span className="mt-1 font-medium text-foreground block truncate">
                    {expense.vendorName || 'Not specified'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Description & Operational Notes */}
          <Card className="border shadow-xs">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Description & Operational Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4 text-xs">
              <div>
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Description
                </Label>
                <p className="mt-1 text-sm text-foreground bg-muted/30 p-3 rounded-lg border">
                  {expense.description}
                </p>
              </div>

              {expense.notes && (
                <div>
                  <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Internal Remarks & Notes
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground bg-muted/20 p-3 rounded-lg border">
                    {expense.notes}
                  </p>
                </div>
              )}

              {/* Rejection Alert if rejected */}
              {isRejected && expense.rejectionReason && (
                <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-900 dark:text-red-300">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-red-700 dark:text-red-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Documented Rejection Reason:</span>
                  </div>
                  <p className="mt-1 text-xs">{expense.rejectionReason}</p>
                </div>
              )}

              {/* Cancellation Alert if cancelled */}
              {isCancelled && expense.cancellationReason && (
                <div className="p-3.5 rounded-lg bg-stone-500/10 border border-stone-500/20 text-stone-900 dark:text-stone-300">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-stone-700 dark:text-stone-400">
                    <Ban className="h-4 w-4" />
                    <span>Documented Cancellation Reason:</span>
                  </div>
                  <p className="mt-1 text-xs">{expense.cancellationReason}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Receipt Proof Attachment Card */}
          <Card className="border shadow-xs">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Proof of Expense / Invoice Receipt
                </CardTitle>
                {expense.receiptUrl && (
                  <a
                    href={expense.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <span>Open in New Window</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {expense.receiptUrl ? (
                <div className="space-y-3">
                  {isPdf ? (
                    <div className="p-8 text-center border rounded-lg bg-muted/20 space-y-3">
                      <FileText className="h-12 w-12 text-primary mx-auto" />
                      <div>
                        <p className="text-xs font-semibold text-foreground">PDF Invoice Document</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Click to view or download the attached document proof.
                        </p>
                      </div>
                      <a
                        href={expense.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button size="sm" variant="outline" className="text-xs gap-1.5">
                          <ExternalLink className="h-3.5 w-3.5" />
                          View PDF Document
                        </Button>
                      </a>
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden bg-black/5 dark:bg-white/5 flex items-center justify-center max-h-96">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={expense.receiptUrl}
                        alt={`Receipt for ${expense.expenseNumber}`}
                        className="max-h-96 w-auto object-contain"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center border border-dashed rounded-lg text-muted-foreground text-xs">
                  <Receipt className="h-8 w-8 mx-auto opacity-40 mb-1.5" />
                  <span>No receipt or invoice attachment uploaded for this expense.</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column (1 Col): Attribution & Audit Trail */}
        <div className="space-y-6">
          {/* User Attribution Card */}
          <Card className="border shadow-xs">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Attribution & Workflow
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-xs">
              <div>
                <span className="text-muted-foreground text-[11px]">Recorded By</span>
                <div className="font-semibold text-foreground mt-0.5">
                  {expense.createdByName || 'System'}
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(expense.createdAt).toLocaleString()}
                </span>
              </div>

              {expense.approvedBy && (
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground text-[11px]">Authorized & Approved By</span>
                  <div className="font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {expense.approvedByName || 'Authorized User'}
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {expense.approvedAt ? new Date(expense.approvedAt).toLocaleString() : 'N/A'}
                  </span>
                </div>
              )}

              {expense.cancelledBy && (
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground text-[11px]">Cancelled By</span>
                  <div className="font-semibold text-stone-700 dark:text-stone-400 mt-0.5">
                    {expense.cancelledByName || 'User'}
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {expense.cancelledAt ? new Date(expense.cancelledAt).toLocaleString() : 'N/A'}
                  </span>
                </div>
              )}

              {expense.templateId && (
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground text-[11px]">Recurring Origin</span>
                  <div className="flex items-center gap-1 text-primary font-medium mt-0.5">
                    <Repeat className="h-3.5 w-3.5" />
                    <span>Generated from template</span>
                  </div>
                  {expense.templateDescription && (
                    <span className="text-[11px] text-muted-foreground">
                      &quot;{expense.templateDescription}&quot;
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Audit History Timeline */}
          <Card className="border shadow-xs">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                Audit Trail ({expense.auditLogs.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Chronological operational lifecycle changes
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              {expense.auditLogs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No audit logs recorded</p>
              ) : (
                <div className="relative border-l border-border/80 pl-4 space-y-4 text-xs ml-2">
                  {expense.auditLogs.map((log) => (
                    <div key={log.id} className="relative">
                      <div className="absolute -left-[21px] top-0.5 h-2.5 w-2.5 rounded-full bg-primary border-2 border-background" />
                      <div className="font-semibold text-foreground">
                        {log.action.replace(/_/g, ' ')}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {log.performedByName} • {new Date(log.createdAt).toLocaleString()}
                      </div>
                      {log.notes && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 bg-muted/30 p-1.5 rounded">
                          {log.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Approval / Rejection Modal */}
      {approvalTarget && (
        <ExpenseApprovalDialog
          open={!!approvalTarget}
          onOpenChange={(open) => !open && setApprovalTarget(null)}
          mode={approvalTarget}
          expense={{
            id: expense.id,
            expenseNumber: expense.expenseNumber,
            amount: expense.amount,
            categoryName: expense.categoryName,
            branchName: expense.branchName,
            description: expense.description,
          }}
          onSuccess={() => {
            startTransition(() => {
              router.refresh();
            });
          }}
        />
      )}

      {/* Cancel Modal */}
      <ExpenseCancelDialog
        open={isCancelOpen}
        onOpenChange={setIsCancelOpen}
        expense={{
          id: expense.id,
          expenseNumber: expense.expenseNumber,
          amount: expense.amount,
          categoryName: expense.categoryName,
          branchName: expense.branchName,
          description: expense.description,
        }}
        onSuccess={() => {
          startTransition(() => {
            router.refresh();
          });
        }}
      />

      {/* Record Corrected Copy Modal */}
      <ExpenseCreateDialog
        open={isCreateCopyOpen}
        onOpenChange={setIsCreateCopyOpen}
        branches={branches}
        categories={categories}
        defaultBranchId={expense.branchId}
        userBranchId={userBranchId}
        onSuccess={() => {
          startTransition(() => {
            router.push('/expenses');
          });
        }}
      />
    </div>
  );
}
