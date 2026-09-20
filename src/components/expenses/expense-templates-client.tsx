'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Repeat,
  ArrowLeft,
  Plus,
  Building2,
  AlertCircle,
  Loader2,
  Zap,
  Power,
} from 'lucide-react';
import { toast } from 'sonner';
import { ExpenseFrequency, ExpenseTemplateStatus, PaymentMethod } from '@prisma/client';

import type { ExpenseTemplateItem } from '@/lib/expenses/types';
import {
  createExpenseTemplate,
  toggleExpenseTemplateStatus,
  createExpenseFromTemplate,
} from '@/lib/expenses/actions';
import {
  EXPENSE_FREQUENCY_META,
  EXPENSE_PAYMENT_METHOD_META,
  formatINR,
} from '@/lib/expenses/constants';
import { PERMISSIONS } from '@/lib/permissions/definitions';

import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface BranchOption {
  id: string;
  name: string;
  code: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

interface ExpenseTemplatesClientProps {
  initialTemplates: ExpenseTemplateItem[];
  branches: BranchOption[];
  categories: CategoryOption[];
  userPermissions: string[];
  defaultBranchId: string;
  userBranchId?: string | null;
}

export function ExpenseTemplatesClient({
  initialTemplates,
  branches,
  categories,
  userPermissions,
  defaultBranchId,
  userBranchId,
}: ExpenseTemplatesClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const todayStr = new Date().toISOString().split('T')[0];

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  // Form states
  const [branchId, setBranchId] = useState<string>(userBranchId || defaultBranchId || branches[0]?.id || '');
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id || '');
  const [description, setDescription] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [frequency, setFrequency] = useState<ExpenseFrequency>(ExpenseFrequency.MONTHLY);
  const [nextDueDate, setNextDueDate] = useState<string>(todayStr);
  const [vendorName, setVendorName] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const canCreate = userPermissions.includes(PERMISSIONS.EXPENSE_TEMPLATE_CREATE);
  const canDeactivate = userPermissions.includes(PERMISSIONS.EXPENSE_TEMPLATE_DEACTIVATE);
  const canRecordExpense = userPermissions.includes(PERMISSIONS.EXPENSE_CREATE);

  const isBranchRestricted = !!userBranchId;

  const openCreateDialog = () => {
    setBranchId(userBranchId || defaultBranchId || branches[0]?.id || '');
    setCategoryId(categories[0]?.id || '');
    setDescription('');
    setAmount('');
    setFrequency(ExpenseFrequency.MONTHLY);
    setNextDueDate(todayStr);
    setVendorName('');
    setPaymentMethod(PaymentMethod.CASH);
    setError(null);
    setIsDialogOpen(true);
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Amount must be greater than ₹0.00');
      return;
    }

    if (!description || description.trim().length < 3) {
      setError('Description must be at least 3 characters long');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await createExpenseTemplate({
        branchId,
        categoryId,
        description: description.trim(),
        amount: parsedAmount,
        frequency,
        nextDueDate,
        vendorName: vendorName.trim() || null,
        paymentMethod,
        status: ExpenseTemplateStatus.ACTIVE,
      });

      if (res.success) {
        toast.success('Recurring expense template created!');
        setIsDialogOpen(false);
        startTransition(() => {
          router.refresh();
        });
      } else {
        setError(res.error || 'Failed to create template');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (tpl: ExpenseTemplateItem) => {
    try {
      const res = await toggleExpenseTemplateStatus(tpl.id);
      if (res.success) {
        toast.success(`Template status updated.`);
        startTransition(() => {
          router.refresh();
        });
      } else {
        toast.error(res.error || 'Failed to toggle status');
      }
    } catch {
      toast.error('Unexpected error toggling status');
    }
  };

  const handleGenerateNow = async (templateId: string) => {
    setGeneratingId(templateId);
    try {
      const res = await createExpenseFromTemplate(templateId);
      if (res.success && res.data) {
        toast.success(`Generated expense ${res.data.expenseNumber} from template! Next due date advanced.`);
        startTransition(() => {
          router.refresh();
        });
      } else {
        toast.error(res.error || 'Failed to generate expense');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate expense');
    } finally {
      setGeneratingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
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
            title="Recurring Expense Templates"
            description="Manage predefined recurring expenditure schedules (e.g. lease rent, monthly utilities, service retainers) and generate expenses manually on demand."
          />
          {canCreate && (
            <Button size="sm" className="gap-1.5" onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              <span>Create Template</span>
            </Button>
          )}
        </div>
      </div>

      {/* Notice Card */}
      <div className="p-4 rounded-xl border bg-primary/5 border-primary/20 text-xs text-muted-foreground flex items-start gap-3">
        <Repeat className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-foreground">Operational Schedule Model: </span>
          <span>
            Templates define expected recurring bills without creating unreviewed transactions. Clicking &quot;Create Expense Now&quot; generates a pending expense record and automatically advances the next due date based on schedule frequency (Weekly, Monthly, or Yearly).
          </span>
        </div>
      </div>

      {/* Templates Table */}
      <Card className="border shadow-xs">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[140px]">Branch</TableHead>
                <TableHead className="w-[140px]">Category</TableHead>
                <TableHead>Description & Vendor</TableHead>
                <TableHead className="w-[110px] text-center">Frequency</TableHead>
                <TableHead className="w-[120px] text-right">Amount</TableHead>
                <TableHead className="w-[130px] text-center">Next Due Date</TableHead>
                <TableHead className="w-[100px] text-center">Status</TableHead>
                <TableHead className="w-[180px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialTemplates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-xs text-muted-foreground">
                    No recurring expense templates configured yet.
                  </TableCell>
                </TableRow>
              ) : (
                initialTemplates.map((tpl) => {
                  const isActive = tpl.status === ExpenseTemplateStatus.ACTIVE;
                  const isOverdue = new Date(tpl.nextDueDate) < new Date(todayStr) && isActive;
                  const isDueToday = tpl.nextDueDate === todayStr && isActive;

                  return (
                    <TableRow key={tpl.id}>
                      <TableCell className="text-xs font-medium">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{tpl.branchName}</span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline" className="text-[11px] font-normal py-0">
                          {tpl.categoryName}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-xs">
                        <div className="font-medium text-foreground">{tpl.description}</div>
                        {tpl.vendorName && (
                          <div className="text-[11px] text-muted-foreground">
                            Vendor: {tpl.vendorName}
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="text-center">
                        <Badge variant="secondary" className="text-[10px] font-medium py-0.5">
                          {EXPENSE_FREQUENCY_META[tpl.frequency]?.label || tpl.frequency}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right text-xs font-bold text-foreground">
                        {formatINR(tpl.amount)}
                      </TableCell>

                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="text-xs font-medium">{tpl.nextDueDate}</span>
                          {isOverdue && (
                            <Badge variant="destructive" className="text-[9px] py-0 px-1">
                              Overdue
                            </Badge>
                          )}
                          {isDueToday && (
                            <Badge className="bg-amber-500 text-white text-[9px] py-0 px-1">
                              Due Today
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] py-0.5 ${
                            isActive
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                              : 'bg-muted text-muted-foreground border-border'
                          }`}
                        >
                          {tpl.status}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canRecordExpense && isActive && (
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 text-[11px] gap-1 px-2"
                              disabled={generatingId === tpl.id}
                              onClick={() => handleGenerateNow(tpl.id)}
                              title="Generate an expense entry from this template and advance due date"
                            >
                              {generatingId === tpl.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Zap className="h-3 w-3" />
                              )}
                              <span>Create Expense</span>
                            </Button>
                          )}

                          {canDeactivate && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-7 w-7 ${
                                isActive ? 'text-muted-foreground hover:text-destructive' : 'text-emerald-600'
                              }`}
                              title={isActive ? 'Deactivate Template' : 'Activate Template'}
                              onClick={() => handleToggleStatus(tpl)}
                            >
                              <Power className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Template Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Repeat className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle>New Recurring Expense Template</DialogTitle>
                <DialogDescription>
                  Setup schedule frequency and baseline cost for predictable operating expenses.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleCreateTemplate} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Branch *</Label>
                <Select
                  value={branchId}
                  onValueChange={(val) => {
                    if (val) setBranchId(val);
                  }}
                  disabled={isBranchRestricted || isSubmitting}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Select Branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Category *</Label>
                <Select
                  value={categoryId}
                  onValueChange={(val) => {
                    if (val) setCategoryId(val);
                  }}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tplDesc" className="text-xs font-semibold text-muted-foreground">
                Description / Purpose *
              </Label>
              <Input
                id="tplDesc"
                placeholder="e.g. Monthly Commercial Lease Rent, Kitchen Water Bill"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Amount (₹) *</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-xs">
                    ₹
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={isSubmitting}
                    className="pl-7 text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Frequency *</Label>
                <Select
                  value={frequency}
                  onValueChange={(val) => {
                    if (val) setFrequency(val as ExpenseFrequency);
                  }}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Select Frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EXPENSE_FREQUENCY_META).map(([key, meta]) => (
                      <SelectItem key={key} value={key}>
                        {meta.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Next Due Date *</Label>
                <Input
                  type="date"
                  value={nextDueDate}
                  onChange={(e) => setNextDueDate(e.target.value)}
                  disabled={isSubmitting}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Payment Method</Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(val) => {
                    if (val) setPaymentMethod(val as PaymentMethod);
                  }}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Tender" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EXPENSE_PAYMENT_METHOD_META).map(([key, meta]) => (
                      <SelectItem key={key} value={key}>
                        {meta.shortLabel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                Vendor Name (Optional)
              </Label>
              <Input
                placeholder="e.g. Mall Management Ltd, Torrent Power"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                disabled={isSubmitting}
                className="text-xs"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Save Template
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
