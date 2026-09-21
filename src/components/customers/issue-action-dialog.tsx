'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CheckCircle2, User, Loader2, ArrowRight } from 'lucide-react';

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
import {
  updateIssueStatus,
  resolveCustomerIssue,
  assignCustomerIssue,
  getAssignableStaff,
} from '@/lib/customers/actions';
import type { CustomerIssueItem, IssueStatus } from '@/lib/customers/types';

interface IssueActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue: CustomerIssueItem | null;
  mode: 'STATUS' | 'ASSIGN' | 'RESOLVE';
  onSuccess?: () => void;
}

export function IssueActionDialog({
  open,
  onOpenChange,
  issue,
  mode,
  onSuccess,
}: IssueActionDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [status, setStatus] = useState<IssueStatus>(issue?.status || 'OPEN');
  const [resolutionNote, setResolutionNote] = useState(issue?.resolutionNote || '');
  const [assignedTo, setAssignedTo] = useState(issue?.assignedTo || '');
  const [staffList, setStaffList] = useState<Array<{ id: string; name: string; designation: string }>>([]);

  useEffect(() => {
    if (open && issue) {
      setStatus(issue.status);
      setResolutionNote(issue.resolutionNote || '');
      setAssignedTo(issue.assignedTo || '');

      getAssignableStaff(issue.branchId).then((res) => {
        if (res.success && res.data) {
          setStaffList(res.data);
        }
      });
    }
  }, [open, issue]);

  if (!issue) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    startTransition(async () => {
      try {
        if (mode === 'RESOLVE') {
          if (!resolutionNote.trim()) {
            toast.error('A clear resolution note is required when resolving an issue');
            return;
          }

          const res = await resolveCustomerIssue({
            issueId: issue.id,
            resolutionNote: resolutionNote.trim(),
          });

          if (res.success) {
            toast.success(`Issue ${issue.issueNumber} marked as RESOLVED`);
            onOpenChange(false);
            router.refresh();
            onSuccess?.();
          } else {
            toast.error(res.error || 'Failed to resolve issue');
          }
        } else if (mode === 'ASSIGN') {
          if (!assignedTo) {
            toast.error('Please select an employee to assign this issue');
            return;
          }

          const res = await assignCustomerIssue({
            issueId: issue.id,
            employeeId: assignedTo,
          });

          if (res.success) {
            toast.success(`Issue ${issue.issueNumber} assigned successfully`);
            onOpenChange(false);
            router.refresh();
            onSuccess?.();
          } else {
            toast.error(res.error || 'Failed to assign issue');
          }
        } else {
          // Status update
          const res = await updateIssueStatus({
            issueId: issue.id,
            status,
            resolutionNote:
              status === 'RESOLVED' || status === 'CLOSED'
                ? resolutionNote.trim()
                : undefined,
          });

          if (res.success) {
            toast.success(`Issue ${issue.issueNumber} status updated to ${status}`);
            onOpenChange(false);
            router.refresh();
            onSuccess?.();
          } else {
            toast.error(res.error || 'Failed to update issue status');
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unexpected error occurred';
        toast.error(message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {mode === 'RESOLVE' && <CheckCircle2 className="size-5 text-emerald-500" />}
              {mode === 'ASSIGN' && <User className="size-5 text-blue-500" />}
              {mode === 'STATUS' && <ArrowRight className="size-5 text-primary" />}
              {mode === 'RESOLVE'
                ? `Resolve Issue ${issue.issueNumber}`
                : mode === 'ASSIGN'
                ? `Assign Issue ${issue.issueNumber}`
                : `Update Status for ${issue.issueNumber}`}
            </DialogTitle>
            <DialogDescription>
              Branch: <span className="font-semibold text-foreground">{issue.branchName}</span>
              {issue.customerName && (
                <>
                  {' '}
                  | Customer: <span className="font-semibold text-foreground">{issue.customerName}</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {mode === 'ASSIGN' && (
              <div className="grid gap-2">
                <Label className="text-xs font-semibold">
                  Select Staff Member ({issue.branchName}) *
                </Label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  disabled={isPending}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  required
                >
                  <option value="">Select Employee...</option>
                  {staffList.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} — {emp.designation}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  Cross-branch assignment is strictly prohibited by security validation.
                </p>
              </div>
            )}

            {mode === 'STATUS' && (
              <div className="grid gap-2">
                <Label className="text-xs font-semibold">New Lifecycle Status *</Label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as IssueStatus)}
                  disabled={isPending}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="OPEN">OPEN - Awaiting action</option>
                  <option value="IN_PROGRESS">IN_PROGRESS - Under active investigation</option>
                  <option value="RESOLVED">RESOLVED - Remedied with customer</option>
                  <option value="CLOSED">CLOSED - Verified and archived</option>
                  <option value="CANCELLED">CANCELLED - Duplicate or invalid</option>
                </select>
              </div>
            )}

            {(mode === 'RESOLVE' || status === 'RESOLVED' || status === 'CLOSED') && (
              <div className="grid gap-2">
                <Label htmlFor="res-note" className="text-xs font-semibold">
                  Resolution Note *
                </Label>
                <Textarea
                  id="res-note"
                  placeholder="Explain actions taken to resolve the incident with the customer (e.g. offered replacement dessert, refunded delivery fee, re-trained counter staff)..."
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  disabled={isPending}
                  rows={3}
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  A resolution note is legally audited and required before marking an issue resolved.
                </p>
              </div>
            )}
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
            <Button
              type="submit"
              disabled={isPending}
              className={
                mode === 'RESOLVE'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5'
                  : 'gap-1.5'
              }
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {mode === 'RESOLVE'
                ? 'Confirm Resolution'
                : mode === 'ASSIGN'
                ? 'Assign Staff'
                : 'Update Status'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
