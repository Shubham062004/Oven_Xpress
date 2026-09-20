'use client';

import { useState, useRef } from 'react';
import {
  Receipt,
  Loader2,
  AlertCircle,
  Upload,
  FileText,
  X,
  Building2,
  Tag,
  DollarSign,
  Calendar,
  CreditCard,
} from 'lucide-react';
import { toast } from 'sonner';
import { PaymentMethod, ExpenseStatus } from '@prisma/client';

import { createExpense } from '@/lib/expenses/actions';
import { EXPENSE_PAYMENT_METHOD_META } from '@/lib/expenses/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

interface CategoryOption {
  id: string;
  name: string;
  description?: string | null;
}

interface ExpenseCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: BranchOption[];
  categories: CategoryOption[];
  defaultBranchId?: string;
  userBranchId?: string | null;
  onSuccess: () => void;
}

export function ExpenseCreateDialog({
  open,
  onOpenChange,
  branches,
  categories,
  defaultBranchId,
  userBranchId,
  onSuccess,
}: ExpenseCreateDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const initialBranch = userBranchId || defaultBranchId || branches[0]?.id || '';
  const initialCategory = categories[0]?.id || '';

  const [branchId, setBranchId] = useState<string>(initialBranch);
  const [categoryId, setCategoryId] = useState<string>(initialCategory);
  const [amount, setAmount] = useState<string>('');
  const [expenseDate, setExpenseDate] = useState<string>(todayStr);
  const [description, setDescription] = useState<string>('');
  const [vendorName, setVendorName] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [receiptUrl, setReceiptUrl] = useState<string>('');
  const [receiptFileName, setReceiptFileName] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isBranchRestricted = !!userBranchId;

  const resetForm = () => {
    setBranchId(userBranchId || defaultBranchId || branches[0]?.id || '');
    setCategoryId(categories[0]?.id || '');
    setAmount('');
    setExpenseDate(todayStr);
    setDescription('');
    setVendorName('');
    setPaymentMethod(PaymentMethod.CASH);
    setReferenceNumber('');
    setNotes('');
    setReceiptUrl('');
    setReceiptFileName('');
    setError(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size client-side (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File exceeds 5MB limit');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/uploads/receipt', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to upload receipt');
      }

      setReceiptUrl(json.url);
      setReceiptFileName(file.name);
      toast.success('Receipt attached successfully');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Receipt upload failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (status: 'DRAFT' | 'PENDING_APPROVAL') => {
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount greater than ₹0.00');
      return;
    }

    if (!branchId) {
      setError('Please select a branch location');
      return;
    }

    if (!categoryId) {
      setError('Please select an expense category');
      return;
    }

    if (!description || description.trim().length < 3) {
      setError('Description must be at least 3 characters long');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await createExpense({
        branchId,
        categoryId,
        amount: parsedAmount,
        expenseDate,
        description: description.trim(),
        vendorName: vendorName.trim() || null,
        paymentMethod,
        referenceNumber: referenceNumber.trim() || null,
        receiptUrl: receiptUrl || null,
        notes: notes.trim() || null,
        status,
        templateId: null,
      });

      if (res.success && res.data) {
        const msg =
          status === ExpenseStatus.DRAFT
            ? `Expense draft ${res.data.expenseNumber} saved!`
            : `Expense ${res.data.expenseNumber} submitted for approval!`;
        toast.success(msg);
        resetForm();
        onOpenChange(false);
        onSuccess();
      } else {
        setError(res.error || 'Failed to record expense');
        toast.error(res.error || 'Failed to record expense');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unexpected error';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Record Operational Expense</DialogTitle>
              <DialogDescription>
                Submit an expense entry with categorized allocation and optional proof receipt.
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          {/* Branch Location */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              Branch Location *
            </Label>
            <Select
              value={branchId}
              onValueChange={(val) => {
                if (val) setBranchId(val);
              }}
              disabled={isBranchRestricted || isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" />
              Expense Category *
            </Label>
            <Select
              value={categoryId}
              onValueChange={(val) => {
                if (val) setCategoryId(val);
              }}
              disabled={isSubmitting}
            >
              <SelectTrigger>
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

          {/* Amount */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5" />
              Expense Amount (₹) *
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
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
                className="pl-8 text-base font-semibold"
              />
            </div>
          </div>

          {/* Business Date */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Expense Date *
            </Label>
            <Input
              type="date"
              max={todayStr}
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Payment Method */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5" />
              Payment Method *
            </Label>
            <Select
              value={paymentMethod}
              onValueChange={(val) => {
                if (val) setPaymentMethod(val as PaymentMethod);
              }}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Tender" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EXPENSE_PAYMENT_METHOD_META).map(([key, meta]) => (
                  <SelectItem key={key} value={key}>
                    {meta.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reference / UTR */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">
              Reference / Cheque / UTR #
            </Label>
            <Input
              placeholder="e.g. UTR-98765432, CHQ-00129"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Vendor Name */}
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-semibold text-muted-foreground">
              Vendor / Beneficiary Name (Optional)
            </Label>
            <Input
              placeholder="e.g. Reliance Energy, Acme Cleaning Services, Local Hardware Mart"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-semibold text-muted-foreground">
              Expense Description *
            </Label>
            <Input
              placeholder="e.g. Electricity bill for kitchen meters, deep cleaning of exhaust chimney"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Receipt Proof / Attachment */}
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
              <span>Receipt Proof Attachment (PDF, JPG, PNG - Max 5MB)</span>
              {receiptUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setReceiptUrl('');
                    setReceiptFileName('');
                  }}
                  className="text-destructive hover:underline text-[11px] flex items-center gap-1"
                >
                  <X className="h-3 w-3" />
                  Remove receipt
                </button>
              )}
            </Label>

            {receiptUrl ? (
              <div className="p-3 rounded-lg border bg-muted/40 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs truncate">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-medium truncate">{receiptFileName || 'Attached Receipt'}</span>
                </div>
                <a
                  href={receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary underline ml-2 shrink-0"
                >
                  View Preview
                </a>
              </div>
            ) : (
              <div className="border border-dashed rounded-lg p-4 text-center hover:bg-muted/20 transition-colors">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  disabled={isUploading || isSubmitting}
                />
                <div className="flex flex-col items-center justify-center gap-1">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground font-medium">
                    {isUploading ? 'Uploading attachment...' : 'Click to select invoice / receipt file'}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-1 h-7 text-xs"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || isSubmitting}
                  >
                    {isUploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    ) : null}
                    Browse Files
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Operational Notes */}
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-semibold text-muted-foreground">
              Internal Operational Notes (Optional)
            </Label>
            <Textarea
              placeholder="e.g. Paid in advance, includes late fee waiver, approved on phone call by GM..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSubmitting}
              className="min-h-16 text-xs"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleSubmit(ExpenseStatus.DRAFT)}
              disabled={isSubmitting || isUploading}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save Draft
            </Button>
            <Button
              type="button"
              onClick={() => handleSubmit(ExpenseStatus.PENDING_APPROVAL)}
              disabled={isSubmitting || isUploading}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Submit for Approval
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
