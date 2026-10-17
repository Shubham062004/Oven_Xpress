'use client';

import { useState, useEffect, useTransition } from 'react';
import { Loader2, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

import type { BranchWithManager, EligibleManager } from '@/lib/branches/actions';
import {
  createBranch,
  updateBranch,
  getEligibleBranchManagers,
} from '@/lib/branches/actions';
import { createBranchSchema, updateBranchSchema } from '@/lib/validations/branch';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

// ─── Props ──────────────────────────────────────────────────────────────────

interface BranchFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch?: BranchWithManager | null; // If provided, the form is in "edit" mode
  onSuccess: (updatedBranch?: BranchWithManager) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function BranchFormDialog({
  open,
  onOpenChange,
  branch,
  onSuccess,
}: BranchFormDialogProps) {
  const isEditing = !!branch;
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Eligible branch managers
  const [eligibleManagers, setEligibleManagers] = useState<EligibleManager[]>([]);
  const [loadingManagers, setLoadingManagers] = useState(false);

  // ─── Form State ─────────────────────────────────────────────────────────

  const [formData, setFormData] = useState({
    name: branch?.name ?? '',
    code: branch?.code ?? '',
    description: branch?.description ?? '',
    address: branch?.address ?? '',
    city: branch?.city ?? '',
    state: branch?.state ?? '',
    postalCode: branch?.postalCode ?? '',
    phone: branch?.phone ?? '',
    email: branch?.email ?? '',
    openingTime: branch?.openingTime ?? '',
    closingTime: branch?.closingTime ?? '',
    status: (branch?.status ?? 'ACTIVE') as 'ACTIVE' | 'INACTIVE',
    managerId: branch?.manager?.id ?? 'UNASSIGNED',
  });

  // Re-sync form data when branch prop changes
  useEffect(() => {
    if (branch) {
      setFormData({
        name: branch.name ?? '',
        code: branch.code ?? '',
        description: branch.description ?? '',
        address: branch.address ?? '',
        city: branch.city ?? '',
        state: branch.state ?? '',
        postalCode: branch.postalCode ?? '',
        phone: branch.phone ?? '',
        email: branch.email ?? '',
        openingTime: branch.openingTime ?? '',
        closingTime: branch.closingTime ?? '',
        status: branch.status ?? 'ACTIVE',
        managerId: branch.manager?.id ?? 'UNASSIGNED',
      });
    } else {
      setFormData({
        name: '',
        code: '',
        description: '',
        address: '',
        city: '',
        state: '',
        postalCode: '',
        phone: '',
        email: '',
        openingTime: '',
        closingTime: '',
        status: 'ACTIVE',
        managerId: 'UNASSIGNED',
      });
    }
    setFieldErrors({});
    setFormError(null);
  }, [branch, open]);

  // Load eligible managers when dialog opens
  useEffect(() => {
    if (!open) return;

    let isMounted = true;
    setLoadingManagers(true);

    getEligibleBranchManagers()
      .then((res) => {
        if (isMounted && res.success && res.data) {
          setEligibleManagers(res.data);
        }
      })
      .catch((err) => {
        console.error('Failed to load eligible managers:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingManagers(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open]);

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear field error on change
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (formError) setFormError(null);
  };

  // ─── Client-side Validation ─────────────────────────────────────────────

  const validateClient = (): boolean => {
    const payload = {
      ...formData,
      managerId: formData.managerId === 'UNASSIGNED' ? null : formData.managerId,
    };
    const schema = isEditing ? updateBranchSchema : createBranchSchema;
    const result = schema.safeParse(payload);

    if (!result.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0]?.toString() ?? '_form';
        if (!errors[key]) errors[key] = [];
        errors[key].push(issue.message);
      }
      setFieldErrors(errors);
      return false;
    }

    setFieldErrors({});
    return true;
  };

  // ─── Submit ─────────────────────────────────────────────────────────────

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Client validation first
    if (!validateClient()) return;

    const payload = {
      ...formData,
      managerId: formData.managerId === 'UNASSIGNED' ? null : formData.managerId,
    };

    startTransition(async () => {
      const result = isEditing
        ? await updateBranch(branch.id, payload)
        : await createBranch(payload);

      if (result.success) {
        toast.success(
          isEditing
            ? `Branch "${formData.name}" updated successfully.`
            : `Branch "${formData.name}" created successfully.`
        );
        onSuccess(result.data);
        onOpenChange(false);
      } else {
        setFormError(result.error ?? 'An unexpected error occurred.');
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
      }
    });
  };

  // ─── Field Helper ───────────────────────────────────────────────────────

  const getFieldError = (field: string) => fieldErrors[field]?.[0];

  const hasAssignedManager = !!branch?.manager?.name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Branch' : 'Add New Branch'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the branch information, manager assignment, and operating status.'
              : 'Fill in the details to create a new restaurant branch.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} id="branch-form" className="space-y-4">
          {/* Form Error */}
          {formError && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {formError}
            </div>
          )}

          {/* Branch Name */}
          <div className="space-y-1.5">
            <Label htmlFor="branch-name">
              Branch Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="branch-name"
              placeholder="e.g. Downtown Main"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              aria-invalid={!!getFieldError('name')}
              disabled={isPending}
            />
            {getFieldError('name') && (
              <p className="text-xs text-destructive">{getFieldError('name')}</p>
            )}
          </div>

          {/* Branch Code */}
          <div className="space-y-1.5">
            <Label htmlFor="branch-code">
              Branch Code <span className="text-destructive">*</span>
            </Label>
            <Input
              id="branch-code"
              placeholder="e.g. DT-MAIN"
              value={formData.code}
              onChange={(e) => updateField('code', e.target.value.toUpperCase())}
              aria-invalid={!!getFieldError('code')}
              disabled={isPending}
            />
            {getFieldError('code') && (
              <p className="text-xs text-destructive">{getFieldError('code')}</p>
            )}
          </div>

          {/* Branch Manager Assignment */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="branch-manager" className="flex items-center gap-1.5">
                <UserCheck className="size-3.5 text-primary" />
                <span>Branch Manager</span>
              </Label>
              <span className="text-xs font-normal text-muted-foreground">
                {hasAssignedManager ? 'Change Manager' : 'Assign Manager'}
              </span>
            </div>

            <Select
              value={formData.managerId}
              onValueChange={(val) => updateField('managerId', val ?? 'UNASSIGNED')}
              disabled={isPending || loadingManagers}
            >
              <SelectTrigger id="branch-manager" className="w-full">
                <SelectValue
                  placeholder={
                    loadingManagers
                      ? 'Loading eligible managers...'
                      : 'Select branch manager'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
                {eligibleManagers.length > 0 ? (
                  eligibleManagers.map((mgr) => (
                    <SelectItem key={mgr.id} value={mgr.id}>
                      {mgr.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="__empty__" disabled>
                    {loadingManagers
                      ? 'Loading managers...'
                      : 'No eligible branch managers available'}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>

            {eligibleManagers.length === 0 && !loadingManagers && (
              <p className="text-xs text-muted-foreground">
                No active users with the Branch Manager role exist yet. Create a user with the MANAGER role to assign one.
              </p>
            )}

            {getFieldError('managerId') && (
              <p className="text-xs text-destructive">{getFieldError('managerId')}</p>
            )}
          </div>

          {/* Branch Status */}
          <div className="space-y-1.5">
            <Label htmlFor="branch-status">Branch Status</Label>
            <Select
              value={formData.status}
              onValueChange={(val) =>
                updateField('status', (val as 'ACTIVE' | 'INACTIVE') ?? 'ACTIVE')
              }
              disabled={isPending}
            >
              <SelectTrigger id="branch-status" className="w-full">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
            {getFieldError('status') && (
              <p className="text-xs text-destructive">{getFieldError('status')}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="branch-description">Description</Label>
            <Input
              id="branch-description"
              placeholder="Brief description of the branch"
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              aria-invalid={!!getFieldError('description')}
              disabled={isPending}
            />
            {getFieldError('description') && (
              <p className="text-xs text-destructive">{getFieldError('description')}</p>
            )}
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <Label htmlFor="branch-address">
              Address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="branch-address"
              placeholder="Street address"
              value={formData.address}
              onChange={(e) => updateField('address', e.target.value)}
              aria-invalid={!!getFieldError('address')}
              disabled={isPending}
            />
            {getFieldError('address') && (
              <p className="text-xs text-destructive">{getFieldError('address')}</p>
            )}
          </div>

          {/* City & State */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="branch-city">
                City <span className="text-destructive">*</span>
              </Label>
              <Input
                id="branch-city"
                placeholder="e.g. Mumbai"
                value={formData.city}
                onChange={(e) => updateField('city', e.target.value)}
                aria-invalid={!!getFieldError('city')}
                disabled={isPending}
              />
              {getFieldError('city') && (
                <p className="text-xs text-destructive">{getFieldError('city')}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="branch-state">State</Label>
              <Input
                id="branch-state"
                placeholder="e.g. Maharashtra"
                value={formData.state}
                onChange={(e) => updateField('state', e.target.value)}
                aria-invalid={!!getFieldError('state')}
                disabled={isPending}
              />
              {getFieldError('state') && (
                <p className="text-xs text-destructive">{getFieldError('state')}</p>
              )}
            </div>
          </div>

          {/* Postal Code */}
          <div className="space-y-1.5">
            <Label htmlFor="branch-postal">Postal Code</Label>
            <Input
              id="branch-postal"
              placeholder="e.g. 400001"
              value={formData.postalCode}
              onChange={(e) => updateField('postalCode', e.target.value)}
              aria-invalid={!!getFieldError('postalCode')}
              disabled={isPending}
            />
            {getFieldError('postalCode') && (
              <p className="text-xs text-destructive">{getFieldError('postalCode')}</p>
            )}
          </div>

          {/* Phone & Email */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="branch-phone">Phone</Label>
              <Input
                id="branch-phone"
                type="tel"
                placeholder="e.g. +91 22 1234 5678"
                value={formData.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                aria-invalid={!!getFieldError('phone')}
                disabled={isPending}
              />
              {getFieldError('phone') && (
                <p className="text-xs text-destructive">{getFieldError('phone')}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="branch-email">Email</Label>
              <Input
                id="branch-email"
                type="email"
                placeholder="e.g. branch@ovenxpress.com"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                aria-invalid={!!getFieldError('email')}
                disabled={isPending}
              />
              {getFieldError('email') && (
                <p className="text-xs text-destructive">{getFieldError('email')}</p>
              )}
            </div>
          </div>

          {/* Operating Hours */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="branch-opening">Opening Time</Label>
              <Input
                id="branch-opening"
                type="time"
                value={formData.openingTime}
                onChange={(e) => updateField('openingTime', e.target.value)}
                aria-invalid={!!getFieldError('openingTime')}
                disabled={isPending}
              />
              {getFieldError('openingTime') && (
                <p className="text-xs text-destructive">{getFieldError('openingTime')}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="branch-closing">Closing Time</Label>
              <Input
                id="branch-closing"
                type="time"
                value={formData.closingTime}
                onChange={(e) => updateField('closingTime', e.target.value)}
                aria-invalid={!!getFieldError('closingTime')}
                disabled={isPending}
              />
              {getFieldError('closingTime') && (
                <p className="text-xs text-destructive">{getFieldError('closingTime')}</p>
              )}
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="branch-form"
            disabled={isPending}
            id="save-branch-button"
          >
            {isPending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
            {isEditing ? 'Save Changes' : 'Create Branch'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
