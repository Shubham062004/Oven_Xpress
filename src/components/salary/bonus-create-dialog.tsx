'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Gift, Award } from 'lucide-react';
import { toast } from 'sonner';

import { BonusType, type SalaryType } from '@prisma/client';
import {
  createBonus,
  createIncentive,
  getActiveEmployeesForSelect,
} from '@/lib/salary/actions';
import { BONUS_TYPE_LABELS } from '@/lib/salary/constants';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface BonusCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId?: string;
  defaultEmployeeId?: string;
  onSuccess?: () => void;
}

export function BonusCreateDialog({
  open,
  onOpenChange,
  branchId,
  defaultEmployeeId,
  onSuccess,
}: BonusCreateDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [category, setCategory] = useState<'BONUS' | 'INCENTIVE'>('BONUS');
  const [employees, setEmployees] = useState<
    Array<{
      id: string;
      employeeCode: string;
      firstName: string;
      lastName: string;
      designation: string;
      branchId: string;
      branchName: string;
      salary: number;
      salaryType: SalaryType;
    }>
  >([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(defaultEmployeeId || '');
  const [amount, setAmount] = useState('');
  const [bonusType, setBonusType] = useState<BonusType>(BonusType.PERFORMANCE);
  const [bonusDate, setBonusDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<
    'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED'
  >('PENDING_APPROVAL');

  useEffect(() => {
    if (open) {
      getActiveEmployeesForSelect(branchId).then((res) => {
        if (res.success && res.data) {
          setEmployees(res.data);
          if (!selectedEmployeeId && res.data.length > 0) {
            setSelectedEmployeeId(defaultEmployeeId || res.data[0].id);
          }
        }
      });
    }
  }, [open, branchId, defaultEmployeeId, selectedEmployeeId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedEmployeeId) {
      toast.error('Please select an employee');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Amount must be greater than zero');
      return;
    }

    if (!reason.trim()) {
      toast.error('Reason is required');
      return;
    }

    startTransition(async () => {
      if (category === 'BONUS') {
        const res = await createBonus({
          employeeId: selectedEmployeeId,
          amount: parsedAmount,
          type: bonusType,
          reason: reason.trim(),
          bonusDate: new Date(bonusDate),
          status,
        });

        if (res.success && res.data) {
          toast.success(
            `Bonus of ₹${parsedAmount.toLocaleString('en-IN')} recorded for ${res.data.employee.firstName} ${res.data.employee.lastName}`
          );
          onOpenChange(false);
          if (onSuccess) onSuccess();
          router.refresh();
        } else {
          toast.error(res.error || 'Failed to award bonus');
        }
      } else {
        const res = await createIncentive({
          employeeId: selectedEmployeeId,
          amount: parsedAmount,
          reason: reason.trim(),
          incentiveDate: new Date(bonusDate),
          status,
        });

        if (res.success && res.data) {
          toast.success(
            `Incentive of ₹${parsedAmount.toLocaleString('en-IN')} recorded for ${res.data.employee.firstName} ${res.data.employee.lastName}`
          );
          onOpenChange(false);
          if (onSuccess) onSuccess();
          router.refresh();
        } else {
          toast.error(res.error || 'Failed to record incentive');
        }
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              {category === 'BONUS' ? (
                <Gift className="size-5 text-primary" />
              ) : (
                <Award className="size-5 text-primary" />
              )}
              Award Compensation Item
            </DialogTitle>
            <DialogDescription>
              Record an approved or pending bonus / incentive for an employee.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {/* Category Toggle */}
            <div className="flex rounded-lg bg-muted p-1 text-xs">
              <button
                type="button"
                onClick={() => setCategory('BONUS')}
                className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
                  category === 'BONUS'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Bonus Award
              </button>
              <button
                type="button"
                onClick={() => setCategory('INCENTIVE')}
                className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
                  category === 'INCENTIVE'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Sales / Target Incentive
              </button>
            </div>

            {/* Employee Picker */}
            <div className="space-y-2">
              <Label htmlFor="bonus-employee" className="text-sm font-semibold">
                Employee
              </Label>
              <select
                id="bonus-employee"
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName} ({emp.employeeCode}) – {emp.designation}
                  </option>
                ))}
              </select>
            </div>

            {/* Bonus Type (if Bonus) */}
            {category === 'BONUS' && (
              <div className="space-y-2">
                <Label htmlFor="bonus-type" className="text-sm font-semibold">
                  Bonus Category
                </Label>
                <select
                  id="bonus-type"
                  value={bonusType}
                  onChange={(e) => setBonusType(e.target.value as BonusType)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  {Object.entries(BONUS_TYPE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="bonus-amount" className="text-sm font-semibold">
                Amount (₹)
              </Label>
              <Input
                id="bonus-amount"
                type="number"
                step="0.01"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 5000"
                required
              />
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="bonus-date" className="text-sm font-semibold">
                Award / Effective Date
              </Label>
              <Input
                id="bonus-date"
                type="date"
                value={bonusDate}
                onChange={(e) => setBonusDate(e.target.value)}
                required
              />
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="bonus-reason" className="text-sm font-semibold">
                Reason & Justification
              </Label>
              <Input
                id="bonus-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Exceptional Diwali Festival Performance, High Customer Rating"
                required
              />
            </div>

            {/* Workflow Status */}
            <div className="space-y-2">
              <Label htmlFor="bonus-status" className="text-sm font-semibold">
                Initial Workflow State
              </Label>
              <select
                id="bonus-status"
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED')
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="PENDING_APPROVAL">Pending Approval (Manager/Admin review)</option>
                <option value="DRAFT">Draft (Save for later)</option>
                <option value="APPROVED">Approved (Directly verified)</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Submitting...' : 'Record Award'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
