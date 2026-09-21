'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { User, Phone, Mail, MapPin, FileText, Loader2 } from 'lucide-react';

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
import { createCustomer, updateCustomer } from '@/lib/customers/actions';
import type { CustomerListItem, CustomerStatus } from '@/lib/customers/types';

interface CustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: CustomerListItem | null;
  onSuccess?: () => void;
}

export function CustomerDialog({
  open,
  onOpenChange,
  customer,
  onSuccess,
}: CustomerDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(customer?.name || '');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [email, setEmail] = useState(customer?.email || '');
  const [address, setAddress] = useState(customer?.address || '');
  const [notes, setNotes] = useState(customer?.notes || '');
  const [status, setStatus] = useState<CustomerStatus>(customer?.status || 'ACTIVE');

  const [prevCustomer, setPrevCustomer] = useState(customer);
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen || customer !== prevCustomer) {
    setPrevOpen(open);
    setPrevCustomer(customer);
    if (open) {
      setName(customer?.name || '');
      setPhone(customer?.phone || '');
      setEmail(customer?.email || '');
      setAddress(customer?.address || '');
      setNotes(customer?.notes || '');
      setStatus(customer?.status || 'ACTIVE');
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Customer name is required');
      return;
    }

    startTransition(async () => {
      try {
        if (customer) {
          const res = await updateCustomer(customer.id, {
            name: name.trim(),
            phone: phone.trim() || null,
            email: email.trim() || null,
            address: address.trim() || null,
            notes: notes.trim() || null,
            status,
          });

          if (res.success) {
            toast.success('Customer updated successfully');
            onOpenChange(false);
            router.refresh();
            onSuccess?.();
          } else {
            toast.error(res.error || 'Failed to update customer');
          }
        } else {
          const res = await createCustomer({
            name: name.trim(),
            phone: phone.trim() || null,
            email: email.trim() || null,
            address: address.trim() || null,
            notes: notes.trim() || null,
          });

          if (res.success) {
            toast.success('Customer created successfully');
            onOpenChange(false);
            router.refresh();
            onSuccess?.();
          } else {
            toast.error(res.error || 'Failed to create customer');
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
            <DialogTitle>{customer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
            <DialogDescription>
              {customer
                ? 'Update customer details and contact preferences.'
                : 'Register a new customer profile. Guest ordering remains supported without mandatory accounts.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name" className="flex items-center gap-1.5 text-xs font-semibold">
                <User className="size-3.5 text-muted-foreground" /> Full Name *
              </Label>
              <Input
                id="name"
                placeholder="e.g. John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isPending}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="phone" className="flex items-center gap-1.5 text-xs font-semibold">
                  <Phone className="size-3.5 text-muted-foreground" /> Phone Number
                </Label>
                <Input
                  id="phone"
                  placeholder="e.g. +91 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isPending}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="email" className="flex items-center gap-1.5 text-xs font-semibold">
                  <Mail className="size-3.5 text-muted-foreground" /> Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="e.g. john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="address" className="flex items-center gap-1.5 text-xs font-semibold">
                <MapPin className="size-3.5 text-muted-foreground" /> Delivery / Street Address
              </Label>
              <Input
                id="address"
                placeholder="e.g. 42 Bakery Lane, Bandra West"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes" className="flex items-center gap-1.5 text-xs font-semibold">
                <FileText className="size-3.5 text-muted-foreground" /> Special Notes / Preferences
              </Label>
              <Textarea
                id="notes"
                placeholder="e.g. Prefers eggless pastries, allergic to peanuts..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isPending}
                rows={3}
              />
            </div>

            {customer && (
              <div className="grid gap-2">
                <Label htmlFor="status" className="text-xs font-semibold">
                  Account Status
                </Label>
                <select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as CustomerStatus)}
                  disabled={isPending}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="ACTIVE">ACTIVE - Ordering Enabled</option>
                  <option value="INACTIVE">INACTIVE - Account Deactivated</option>
                </select>
                <p className="text-[11px] text-muted-foreground">
                  Deactivating a customer will not delete past orders, payments, reviews, or logged issues.
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
            <Button type="submit" disabled={isPending} className="gap-1.5">
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {customer ? 'Save Changes' : 'Create Customer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
