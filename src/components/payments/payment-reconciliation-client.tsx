'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FileSpreadsheet,
  ArrowLeft,
  Building2,
  Banknote,
  Smartphone,
  CreditCard,
  Globe,
  HelpCircle,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  History,
} from 'lucide-react';
import { toast } from 'sonner';
import { ReconciliationStatus } from '@prisma/client';

import {
  getDailyReconciliationData,
  submitReconciliation,
  getReconciliationHistory,
} from '@/lib/payments/actions';
import type {
  DailyReconciliationData,
  ReconciliationHistoryItem,
} from '@/lib/payments/types';

import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
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

interface PaymentReconciliationClientProps {
  branches: BranchOption[];
  defaultBranchId: string;
  initialHistory: ReconciliationHistoryItem[];
  userBranchId?: string | null;
}

export function PaymentReconciliationClient({
  branches,
  defaultBranchId,
  initialHistory,
  userBranchId,
}: PaymentReconciliationClientProps) {
  const router = useRouter();

  const todayStr = new Date().toISOString().split('T')[0];

  const [selectedBranch, setSelectedBranch] = useState<string>(defaultBranchId);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [data, setData] = useState<DailyReconciliationData | null>(null);
  const [history, setHistory] = useState<ReconciliationHistoryItem[]>(initialHistory);
  const [loading, setLoading] = useState<boolean>(true);

  // Reconciliation form
  const [actualCash, setActualCash] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);

  const isBranchRestricted = !!userBranchId;

  const handleBranchChange = (branchId: string | null) => {
    if (!branchId) return;
    setSelectedBranch(branchId);
    setLoading(true);
    setError(null);
    setShowConfirm(false);
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setLoading(true);
    setError(null);
    setShowConfirm(false);
  };

  // Load reconciliation data when branch or date changes
  useEffect(() => {
    let isMounted = true;

    getDailyReconciliationData(selectedBranch, selectedDate)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          setData(res.data);
          if (res.data.existingReconciliation) {
            setActualCash(res.data.existingReconciliation.actualCash.toFixed(2));
            setNote(res.data.existingReconciliation.note || '');
          } else {
            setActualCash('');
            setNote('');
          }
        } else {
          setError(res.error || 'Failed to load tender data');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Error fetching data');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedBranch, selectedDate]);

  const parsedActualCash = parseFloat(actualCash) || 0;
  const systemCash = data ? data.systemCash : 0;
  const variance = Math.round((parsedActualCash - systemCash) * 100) / 100;

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (actualCash.trim() === '' || isNaN(parseFloat(actualCash))) {
      setError('Please enter a valid physical cash drawer count');
      return;
    }
    if (parsedActualCash < 0) {
      setError('Actual cash count cannot be negative');
      return;
    }

    setError(null);
    setShowConfirm(true);
  };

  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await submitReconciliation({
        branchId: selectedBranch,
        date: selectedDate,
        actualCash: parsedActualCash,
        note: note.trim() || undefined,
        status: ReconciliationStatus.RECONCILED,
      });

      if (res.success && res.data) {
        toast.success(`Daily reconciliation saved for ${selectedDate}!`);
        setShowConfirm(false);

        // Update local data and history
        if (data) {
          setData({
            ...data,
            existingReconciliation: {
              id: res.data.id,
              actualCash: res.data.actualCash,
              variance: res.data.variance,
              note: res.data.note,
              reconciledBy: res.data.reconciledBy,
              reconciledAt: res.data.reconciledAt,
              status: res.data.status,
            },
          });
        }

        const histRes = await getReconciliationHistory(
          selectedBranch === 'all' ? undefined : selectedBranch
        );
        if (histRes.success && histRes.data) {
          setHistory(histRes.data);
        }

        router.refresh();
      } else {
        setError(res.error || 'Failed to submit reconciliation');
        toast.error(res.error || 'Failed to submit reconciliation');
        setShowConfirm(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Submission failed';
      setError(msg);
      toast.error(msg);
      setShowConfirm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper for neutral variance presentation
  const getVariancePresentation = (v: number) => {
    if (Math.abs(v) < 0.01) {
      return {
        label: 'Balanced (₹0.00 difference)',
        color: 'text-emerald-600 dark:text-emerald-400',
        badge: 'Balanced',
        badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
      };
    }
    if (v > 0) {
      return {
        label: `+₹${v.toFixed(2)} Surplus difference`,
        color: 'text-blue-600 dark:text-blue-400',
        badge: 'Surplus',
        badgeClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
      };
    }
    return {
      label: `-₹${Math.abs(v).toFixed(2)} Shortfall difference`,
      color: 'text-amber-600 dark:text-amber-400',
      badge: 'Shortfall',
      badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
    };
  };

  const varianceInfo = getVariancePresentation(variance);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/payments"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Payments
        </Link>
        <PageHeader
          title="Daily Tender & Cash Reconciliation"
          description="Compare point-of-sale tender records with physical cash drawer counts. Objective differences are audited without automated error assumptions."
        />
      </div>

      {/* Control Selector Bar */}
      <Card className="border shadow-xs">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Branch Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                Branch Location
              </Label>
              <Select
                value={selectedBranch}
                onValueChange={handleBranchChange}
                disabled={isBranchRestricted || loading}
              >
                <SelectTrigger className="w-full">
                  <div className="flex items-center gap-2 truncate">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <SelectValue placeholder="Select Branch" />
                  </div>
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

            {/* Date Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                Reconciliation Date
              </Label>
              <div className="relative">
                <Input
                  type="date"
                  max={todayStr}
                  value={selectedDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  disabled={loading}
                  className="w-full"
                />
              </div>
            </div>

            {/* Existing Status Indicator */}
            <div className="space-y-1.5 sm:col-span-2 flex flex-col justify-end">
              {data?.existingReconciliation ? (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                      Reconciled on {new Date(data.existingReconciliation.reconciledAt).toLocaleDateString()} by {data.existingReconciliation.reconciledBy}
                    </span>
                  </div>
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-[10px]">
                    RECONCILED
                  </Badge>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-amber-700 dark:text-amber-300 font-medium">
                    No reconciliation submitted for this date yet. Status is OPEN.
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Reconciliation Grid */}
      {loading ? (
        <Card className="border p-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading tender breakdown...</p>
        </Card>
      ) : data ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: System Tender Totals Table */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border shadow-xs">
              <CardHeader className="py-3 px-6 border-b bg-muted/20">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-primary" />
                    System Payment Ledger Breakdown ({selectedDate})
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">
                    Trusted database transactions
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment Tender Method</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">System Recorded Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-semibold flex items-center gap-2">
                        <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        Cash (Point-of-Sale)
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        Physical Drawer ({data.cashPaymentCount} txn{data.cashPaymentCount === 1 ? '' : 's'})
                      </TableCell>
                      <TableCell className="text-right font-bold text-base text-emerald-600 dark:text-emerald-400">
                        ₹{data.systemCash.toFixed(2)}
                      </TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell className="font-semibold flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        UPI Digital Payments
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        Digital / Settlement
                      </TableCell>
                      <TableCell className="text-right font-bold text-base">
                        ₹{data.systemUpi.toFixed(2)}
                      </TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell className="font-semibold flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        Credit / Debit Card
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        POS Terminal
                      </TableCell>
                      <TableCell className="text-right font-bold text-base">
                        ₹{data.systemCard.toFixed(2)}
                      </TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell className="font-semibold flex items-center gap-2">
                        <Globe className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        Online Gateway
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        Web / App Gateway
                      </TableCell>
                      <TableCell className="text-right font-bold text-base">
                        ₹{data.systemOnline.toFixed(2)}
                      </TableCell>
                    </TableRow>

                    {data.systemOther > 0 && (
                      <TableRow>
                        <TableCell className="font-semibold flex items-center gap-2">
                          <HelpCircle className="h-4 w-4 text-muted-foreground" />
                          Other / Voucher
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          Voucher / Token
                        </TableCell>
                        <TableCell className="text-right font-bold text-base">
                          ₹{data.systemOther.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    )}

                    {data.totalRefunds > 0 && (
                      <TableRow className="bg-purple-500/5">
                        <TableCell className="font-semibold flex items-center gap-2 text-purple-700 dark:text-purple-300">
                          <RotateCcw className="h-4 w-4" />
                          Total Refunds Recorded
                        </TableCell>
                        <TableCell className="text-xs text-purple-600 dark:text-purple-400">
                          Reversals on {selectedDate}
                        </TableCell>
                        <TableCell className="text-right font-bold text-base text-purple-700 dark:text-purple-300">
                          -₹{data.totalRefunds.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>

              <CardFooter className="flex justify-between items-center p-4 bg-muted/20 border-t">
                <div>
                  <span className="text-xs text-muted-foreground block">
                    All Tenders Total (Gross)
                  </span>
                  <span className="text-lg font-bold text-foreground">
                    ₹{data.systemTotal.toFixed(2)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground block">
                    Net Collected (Less Refunds)
                  </span>
                  <span className="text-xl font-bold text-primary">
                    ₹{(data.systemTotal - data.totalRefunds).toFixed(2)}
                  </span>
                </div>
              </CardFooter>
            </Card>

            {/* Historical Reconciliations Table */}
            <Card className="border shadow-xs">
              <CardHeader className="py-3 px-6 border-b bg-muted/20">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  Recent Reconciliation Records
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {history.length === 0 ? (
                  <p className="p-6 text-center text-xs text-muted-foreground">
                    No reconciliation history recorded yet.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead className="text-right">System Cash</TableHead>
                        <TableHead className="text-right">Actual Count</TableHead>
                        <TableHead className="text-right">Variance</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reconciled By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.slice(0, 8).map((h) => {
                        const hVar = getVariancePresentation(h.variance);
                        return (
                          <TableRow key={h.id} className="text-xs">
                            <TableCell className="font-semibold">{h.date}</TableCell>
                            <TableCell>{h.branchName}</TableCell>
                            <TableCell className="text-right">₹{h.systemCash.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-medium">₹{h.actualCash.toFixed(2)}</TableCell>
                            <TableCell className={`text-right font-bold ${hVar.color}`}>
                              {h.variance > 0 ? `+₹${h.variance.toFixed(2)}` : `₹${h.variance.toFixed(2)}`}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={hVar.badgeClass}>
                                {hVar.badge}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{h.reconciledBy}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Col: Physical Cash Drawer Count & Reconciliation Form */}
          <div className="space-y-6">
            <Card className="border shadow-xs">
              <CardHeader className="py-3 px-6 border-b bg-muted/20">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Physical Cash Drawer Reconciliation
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <form onSubmit={handlePreSubmit} className="space-y-4">
                  {/* System Cash Snapshot */}
                  <div className="p-3 rounded-xl bg-muted/40 border space-y-1">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                      System Cash Total (Expected)
                    </span>
                    <span className="text-2xl font-bold text-foreground">
                      ₹{systemCash.toFixed(2)}
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      From {data.cashPaymentCount} cash transaction{data.cashPaymentCount === 1 ? '' : 's'} on {selectedDate}
                    </p>
                  </div>

                  {/* Physical Count Input */}
                  <div className="space-y-1.5">
                    <Label htmlFor="actualCash" className="text-sm font-semibold">
                      Actual Cash Count (Physical Drawer) <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                        ₹
                      </span>
                      <Input
                        id="actualCash"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={actualCash}
                        onChange={(e) => {
                          setActualCash(e.target.value);
                          setError(null);
                        }}
                        disabled={isSubmitting}
                        className="pl-7 text-lg font-bold text-foreground"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Enter total counted physical currency notes and coins in the drawer.
                    </p>
                  </div>

                  {/* Live Variance Calculation Display */}
                  {actualCash.trim() !== '' && !isNaN(parsedActualCash) && (
                    <div className="p-3.5 rounded-xl border bg-card space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-muted-foreground">
                          Reconciliation Difference:
                        </span>
                        <Badge variant="outline" className={varianceInfo.badgeClass}>
                          {varianceInfo.badge}
                        </Badge>
                      </div>

                      <div className="flex items-baseline justify-between pt-1">
                        <span className="text-xs text-muted-foreground">
                          Actual - System Cash:
                        </span>
                        <span className={`text-xl font-bold ${varianceInfo.color}`}>
                          {variance > 0 ? `+₹${variance.toFixed(2)}` : `₹${variance.toFixed(2)}`}
                        </span>
                      </div>

                      <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                        {Math.abs(variance) < 0.01
                          ? 'Physical cash perfectly matches system transactions.'
                          : 'Operational variance noted. Saved objectively for branch audit.'}
                      </p>
                    </div>
                  )}

                  {/* Notes / Clarification */}
                  <div className="space-y-1.5">
                    <Label htmlFor="reconciliationNote" className="text-sm font-medium">
                      Operational Notes (Optional)
                    </Label>
                    <Textarea
                      id="reconciliationNote"
                      placeholder="e.g. Morning drawer opening balance ₹500 included, small petty cash difference, customer change issue..."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      disabled={isSubmitting}
                      className="min-h-[75px] resize-none text-xs"
                    />
                  </div>

                  {error && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-lg flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isSubmitting || actualCash.trim() === ''}
                    className="w-full font-semibold gap-1.5 shadow-xs"
                  >
                    {data.existingReconciliation ? 'Update Daily Reconciliation' : 'Submit Reconciliation'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {/* Confirmation Modal */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary">
              <ShieldCheck className="h-5 w-5" />
              <DialogTitle>Confirm Daily Cash Reconciliation</DialogTitle>
            </div>
            <DialogDescription>
              Please verify your physical drawer count and difference before finalizing the audit record.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 rounded-xl bg-muted/40 border space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Branch:</span>
                <span className="font-semibold text-foreground">{data?.branchName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date:</span>
                <span className="font-semibold text-foreground">{selectedDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">System Cash:</span>
                <span className="font-semibold text-foreground">₹{systemCash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Actual Cash:</span>
                <span className="font-bold text-foreground">₹{parsedActualCash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t">
                <span className="text-muted-foreground">Variance:</span>
                <span className={`font-bold ${varianceInfo.color}`}>
                  {variance > 0 ? `+₹${variance.toFixed(2)}` : `₹${variance.toFixed(2)}`}
                </span>
              </div>
            </div>

            {note.trim() && (
              <div className="p-2.5 rounded-lg bg-muted/20 border text-muted-foreground">
                <span className="font-semibold text-foreground block">Note:</span>
                {note.trim()}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowConfirm(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmSubmit}
              disabled={isSubmitting}
              className="gap-1.5 font-semibold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirm & Finalize
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
