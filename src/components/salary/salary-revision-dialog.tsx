'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

import { SalaryType } from '@prisma/client';
import { reviseSalary, getActiveEmployeesForSelect } from '@/lib/salary/actions';
import { formatINR } from '@/lib/salary/constants';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SalaryRevisionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEmployeeId?: string;
  branchId?: string;
  onSuccess?: () => void;
}

export function SalaryRevisionDialog({
  open,
  onOpenChange,
  defaultEmployeeId,
  branchId,
  onSuccess,
}: SalaryRevisionDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

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
  const [newSalary, setNewSalary] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  // Load employees
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

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);
  const currentSalaryNumber = selectedEmployee ? selectedEmployee.salary : 0;
  const parsedNewSalary = parseFloat(newSalary) || 0;
  const difference = parsedNewSalary - currentSalaryNumber;
  const percentage =
    currentSalaryNumber > 0
      ? Number(((difference / currentSalaryNumber) * 100).toFixed(2))
      : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedEmployeeId) {
      toast.error('Please select an employee');
      return;
    }

    if (parsedNewSalary <= 0) {
      toast.error('New salary must be greater than zero');
      return;
    }

    if (!reason.trim()) {
      toast.error('Reason for salary revision is required');
      return;
    }

    startTransition(async () => {
      const res = await reviseSalary({
        employeeId: selectedEmployeeId,
        newSalary: parsedNewSalary,
        salaryType: selectedEmployee?.salaryType || SalaryType.MONTHLY,
        effectiveDate: new Date(effectiveDate),
        reason: reason.trim(),
        notes: notes.trim() || undefined,
      });

      if (res.success && res.data) {
        toast.success(
          `Salary revised for ${res.data.employee.firstName} ${res.data.employee.lastName} (${difference >= 0 ? '+' : ''}${formatINR(difference)} / ${percentage >= 0 ? '+' : ''}${percentage}%)`
        );
        onOpenChange(false);
        if (onSuccess) onSuccess();
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to revise salary');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <TrendingUp className="size-5 text-primary" />
              Revise Employee Salary
            </DialogTitle>
            <DialogDescription>
              Record a salary increment or structure revision with historical preservation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {/* Employee Select */}
            <div className="space-y-2">
              <Label htmlFor="revision-employee" className="text-sm font-semibold">
                Employee
              </Label>
              <select
                id="revision-employee"
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

            {/* Current vs New Salary Box */}
            <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-muted-foreground">Current Salary</span>
                  <p className="text-base font-bold text-foreground">
                    {formatINR(currentSalaryNumber)}
                  </p>
                  <Badge variant="outline" className="text-[10px] mt-0.5">
                    {selectedEmployee?.salaryType || 'MONTHLY'}
                  </Badge>
                </div>
                <ArrowRight className="size-4 text-muted-foreground" />
                <div className="text-right">
                  <span className="text-xs text-muted-foreground">New Proposed Salary</span>
                  <p className="text-base font-bold text-primary">
                    {parsedNewSalary > 0 ? formatINR(parsedNewSalary) : '₹0'}
                  </p>
                  <span className="text-[10px] text-muted-foreground">
                    {selectedEmployee?.salaryType || 'MONTHLY'}
                  </span>
                </div>
              </div>

              {parsedNewSalary > 0 && (
                <div className="flex items-center justify-between border-t pt-2 text-xs">
                  <span className="text-muted-foreground">Difference:</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-semibold ${difference >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
                    >
                      {difference >= 0 ? '+' : ''}
                      {formatINR(difference)}
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        difference >= 0
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                          : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400'
                      }
                    >
                      {percentage >= 0 ? '+' : ''}
                      {percentage}%
                    </Badge>
                  </div>
                </div>
              )}
            </div>

            {/* New Salary Input */}
            <div className="space-y-2">
              <Label htmlFor="revision-new-salary" className="text-sm font-semibold">
                New Base Salary (₹)
              </Label>
              <Input
                id="revision-new-salary"
                type="number"
                step="0.01"
                min="1"
                value={newSalary}
                onChange={(e) => setNewSalary(e.target.value)}
                placeholder="e.g. 25000"
                required
              />
            </div>

            {/* Effective Date */}
            <div className="space-y-2">
              <Label htmlFor="revision-effective-date" className="text-sm font-semibold">
                Effective Start Date
              </Label>
              <Input
                id="revision-effective-date"
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Previous salary structure will be superseded on the day preceding this date.
              </p>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="revision-reason" className="text-sm font-semibold">
                Revision Reason
              </Label>
              <Input
                id="revision-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Annual Appraisal 2026, Promotion to Senior Chef"
                required
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="revision-notes" className="text-sm font-semibold">
                Notes (Optional)
              </Label>
              <Textarea
                id="revision-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional appraisal or compensation notes..."
              />
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
            <Button type="submit" disabled={isPending || parsedNewSalary <= 0}>
              {isPending ? 'Applying...' : 'Apply Revision'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
