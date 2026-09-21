'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertCircle, Loader2, User, Building2, Tag } from 'lucide-react';

import { Button } from '@/components/ui/button';
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
import { createCustomerIssue, getAssignableStaff } from '@/lib/customers/actions';
import type { IssueType, IssuePriority } from '@/lib/customers/types';

interface IssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId?: string;
  customerName?: string;
  orderId?: string;
  orderNumber?: string;
  branchId?: string;
  branches: Array<{ id: string; name: string }>;
  onSuccess?: () => void;
}

export function IssueDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  orderId,
  orderNumber,
  branchId: defaultBranchId,
  branches,
  onSuccess,
}: IssueDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedBranchId, setSelectedBranchId] = useState(defaultBranchId || branches[0]?.id || '');
  const [type, setType] = useState<IssueType>('FOOD_QUALITY');
  const [priority, setPriority] = useState<IssuePriority>('MEDIUM');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [staffList, setStaffList] = useState<Array<{ id: string; name: string; designation: string }>>([]);

  useEffect(() => {
    if (open) {
      if (defaultBranchId) {
        setSelectedBranchId(defaultBranchId);
      } else if (branches.length > 0) {
        setSelectedBranchId(branches[0].id);
      }
    }
  }, [open, defaultBranchId, branches]);

  // Load assignable staff whenever selected branch changes
  useEffect(() => {
    if (!selectedBranchId) return;
    let isMounted = true;

    getAssignableStaff(selectedBranchId).then((res) => {
      if (isMounted && res.success && res.data) {
        setStaffList(res.data);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [selectedBranchId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedBranchId) {
      toast.error('Branch is required for issue logging');
      return;
    }
    if (!description.trim()) {
      toast.error('Issue description is required');
      return;
    }

    startTransition(async () => {
      try {
        const res = await createCustomerIssue({
          customerId: customerId || undefined,
          orderId: orderId || undefined,
          branchId: selectedBranchId,
          type,
          priority,
          description: description.trim(),
          assignedTo: assignedTo || undefined,
        });

        if (res.success) {
          toast.success(
            `Issue ${res.data?.issueNumber || ''} created successfully with strict branch verification.`
          );
          setDescription('');
          setAssignedTo('');
          onOpenChange(false);
          router.refresh();
          onSuccess?.();
        } else {
          toast.error(res.error || 'Failed to create issue');
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unexpected error occurred';
        toast.error(message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="size-5 text-amber-500" />
              Log Customer Operational Issue
            </DialogTitle>
            <DialogDescription>
              Record an operational complaint, service discrepancy, or food quality issue. Issues follow a tracked lifecycle without attributing automatic fault.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Customer & Order Context Badge */}
            {(customerName || orderNumber) && (
              <div className="rounded-lg bg-muted/60 p-3 text-xs flex flex-wrap gap-4 items-center">
                {customerName && (
                  <div>
                    <span className="text-muted-foreground">Customer: </span>
                    <span className="font-semibold">{customerName}</span>
                  </div>
                )}
                {orderNumber && (
                  <div>
                    <span className="text-muted-foreground">Linked Order: </span>
                    <span className="font-semibold">{orderNumber}</span>
                  </div>
                )}
              </div>
            )}

            {/* Branch Selection */}
            <div className="grid gap-2">
              <Label className="flex items-center gap-1.5 text-xs font-semibold">
                <Building2 className="size-3.5 text-muted-foreground" /> Responsible Branch *
              </Label>
              <select
                value={selectedBranchId}
                onChange={(e) => {
                  setSelectedBranchId(e.target.value);
                  setAssignedTo('');
                }}
                disabled={!!defaultBranchId || isPending}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-75"
                required
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Type and Priority */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label className="flex items-center gap-1.5 text-xs font-semibold">
                  <Tag className="size-3.5 text-muted-foreground" /> Issue Category *
                </Label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as IssueType)}
                  disabled={isPending}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="FOOD_QUALITY">Food Quality</option>
                  <option value="WRONG_ORDER">Wrong Order</option>
                  <option value="MISSING_ITEM">Missing Item</option>
                  <option value="LATE_ORDER">Late Order / Delay</option>
                  <option value="PAYMENT">Payment Discrepancy</option>
                  <option value="STAFF_SERVICE">Staff Service</option>
                  <option value="CLEANLINESS">Cleanliness</option>
                  <option value="DELIVERY">Delivery Problem</option>
                  <option value="OTHER">Other Inquiry</option>
                </select>
              </div>

              <div className="grid gap-2">
                <Label className="flex items-center gap-1.5 text-xs font-semibold">
                  Priority Level *
                </Label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as IssuePriority)}
                  disabled={isPending}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="LOW">Low - General Feedback</option>
                  <option value="MEDIUM">Medium - Attention Needed</option>
                  <option value="HIGH">High - Urgent Resolution</option>
                  <option value="URGENT">Urgent - Critical Escalation</option>
                </select>
              </div>
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="issue-desc" className="text-xs font-semibold">
                Complaint / Incident Description *
              </Label>
              <Textarea
                id="issue-desc"
                placeholder="Detail the issue reported by the customer. E.g. Chicken pizza arrived cold, crust was burnt..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isPending}
                rows={3}
                required
              />
            </div>

            {/* Staff Assignment */}
            <div className="grid gap-2">
              <Label className="flex items-center gap-1.5 text-xs font-semibold">
                <User className="size-3.5 text-muted-foreground" /> Assign to Branch Staff (Optional)
              </Label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                disabled={isPending}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">Unassigned (Queue for Branch Supervisor)</option>
                {staffList.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} — {emp.designation}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                Branch security prohibits cross-branch assignment. Only active employees belonging to the selected branch are listed.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="gap-1.5">
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Log Issue
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
