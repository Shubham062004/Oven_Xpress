'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { SupplierStatus } from '@prisma/client';
import type { SupplierListItem, SupplierDetail } from '@/lib/suppliers/types';
import { createSupplier, updateSupplier } from '@/lib/suppliers/actions';
import { createSupplierSchema } from '@/lib/validations/suppliers';

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

interface SupplierFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: SupplierListItem | SupplierDetail | null;
  onSuccess: () => void;
}

interface InnerFormProps {
  supplier?: SupplierListItem | SupplierDetail | null;
  onClose: () => void;
  onSuccess: () => void;
}

function SupplierFormInner({ supplier, onClose, onSuccess }: InnerFormProps) {
  const isEditing = !!supplier;
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: supplier?.name ?? '',
    contactPerson: supplier?.contactPerson ?? '',
    phone: supplier?.phone ?? '',
    email: supplier?.email ?? '',
    address: supplier?.address ?? '',
    city: supplier?.city ?? '',
    state: supplier?.state ?? '',
    postalCode: supplier?.postalCode ?? '',
    notes: supplier?.notes ?? '',
  });

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (formError) setFormError(null);
  };

  const validateClient = (): boolean => {
    const result = createSupplierSchema.safeParse(formData);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!validateClient()) {
      return;
    }

    startTransition(async () => {
      try {
        if (isEditing && supplier) {
          const res = await updateSupplier(supplier.id, {
            name: formData.name,
            contactPerson: formData.contactPerson || undefined,
            phone: formData.phone || undefined,
            email: formData.email || undefined,
            address: formData.address || undefined,
            city: formData.city || undefined,
            state: formData.state || undefined,
            postalCode: formData.postalCode || undefined,
            notes: formData.notes || undefined,
            status: supplier.status,
          });

          if (!res.success) {
            setFormError(res.error || 'Failed to update supplier');
            toast.error(res.error || 'Failed to update supplier');
            return;
          }

          toast.success(`Supplier "${formData.name}" updated successfully`);
        } else {
          const res = await createSupplier({
            name: formData.name,
            contactPerson: formData.contactPerson || undefined,
            phone: formData.phone || undefined,
            email: formData.email || undefined,
            address: formData.address || undefined,
            city: formData.city || undefined,
            state: formData.state || undefined,
            postalCode: formData.postalCode || undefined,
            notes: formData.notes || undefined,
            status: SupplierStatus.ACTIVE,
          });

          if (!res.success) {
            setFormError(res.error || 'Failed to create supplier');
            toast.error(res.error || 'Failed to create supplier');
            return;
          }

          toast.success(`Supplier "${formData.name}" created successfully`);
        }

        onClose();
        onSuccess();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'An unexpected error occurred';
        setFormError(msg);
        toast.error(msg);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      {formError && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          {formError}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="supplier-name">
          Supplier / Company Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="supplier-name"
          placeholder="e.g. Metro Dairy & Cheese"
          value={formData.name}
          onChange={(e) => updateField('name', e.target.value)}
          disabled={isPending}
        />
        {fieldErrors.name && (
          <p className="text-xs text-destructive">{fieldErrors.name[0]}</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="contact-person">Contact Person</Label>
          <Input
            id="contact-person"
            placeholder="e.g. Sunil Mehta"
            value={formData.contactPerson}
            onChange={(e) => updateField('contactPerson', e.target.value)}
            disabled={isPending}
          />
          {fieldErrors.contactPerson && (
            <p className="text-xs text-destructive">{fieldErrors.contactPerson[0]}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="supplier-phone">Phone Number</Label>
          <Input
            id="supplier-phone"
            placeholder="e.g. +91 98200 44556"
            value={formData.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            disabled={isPending}
          />
          {fieldErrors.phone && (
            <p className="text-xs text-destructive">{fieldErrors.phone[0]}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="supplier-email">Email Address</Label>
        <Input
          id="supplier-email"
          type="email"
          placeholder="e.g. orders@metrodairy.com"
          value={formData.email}
          onChange={(e) => updateField('email', e.target.value)}
          disabled={isPending}
        />
        {fieldErrors.email && (
          <p className="text-xs text-destructive">{fieldErrors.email[0]}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="supplier-address">Street Address</Label>
        <Input
          id="supplier-address"
          placeholder="e.g. Plot 45, APMC Market, Turbhe"
          value={formData.address}
          onChange={(e) => updateField('address', e.target.value)}
          disabled={isPending}
        />
        {fieldErrors.address && (
          <p className="text-xs text-destructive">{fieldErrors.address[0]}</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="supplier-city">City</Label>
          <Input
            id="supplier-city"
            placeholder="e.g. Navi Mumbai"
            value={formData.city}
            onChange={(e) => updateField('city', e.target.value)}
            disabled={isPending}
          />
          {fieldErrors.city && (
            <p className="text-xs text-destructive">{fieldErrors.city[0]}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="supplier-state">State</Label>
          <Input
            id="supplier-state"
            placeholder="e.g. Maharashtra"
            value={formData.state}
            onChange={(e) => updateField('state', e.target.value)}
            disabled={isPending}
          />
          {fieldErrors.state && (
            <p className="text-xs text-destructive">{fieldErrors.state[0]}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="supplier-postal">Postal Code</Label>
          <Input
            id="supplier-postal"
            placeholder="e.g. 400705"
            value={formData.postalCode}
            onChange={(e) => updateField('postalCode', e.target.value)}
            disabled={isPending}
          />
          {fieldErrors.postalCode && (
            <p className="text-xs text-destructive">{fieldErrors.postalCode[0]}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="supplier-notes">Operational Notes</Label>
        <Input
          id="supplier-notes"
          placeholder="e.g. Delivery timings, preferred order placement days"
          value={formData.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          disabled={isPending}
        />
        {fieldErrors.notes && (
          <p className="text-xs text-destructive">{fieldErrors.notes[0]}</p>
        )}
      </div>

      <DialogFooter className="gap-2 sm:gap-0 pt-3">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? 'Save Changes' : 'Add Supplier'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function SupplierFormDialog({
  open,
  onOpenChange,
  supplier,
  onSuccess,
}: SupplierFormDialogProps) {
  const isEditing = !!supplier;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Supplier' : 'Add New Supplier'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update supplier contact information and details.'
              : 'Add a new vendor or supplier to the master directory.'}
          </DialogDescription>
        </DialogHeader>

        {open && (
          <SupplierFormInner
            key={supplier?.id ?? 'new-supplier'}
            supplier={supplier}
            onClose={() => onOpenChange(false)}
            onSuccess={onSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
