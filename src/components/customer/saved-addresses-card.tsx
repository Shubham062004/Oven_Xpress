'use client';

import React, { useState } from 'react';
import {
  MapPin,
  Home,
  Briefcase,
  Edit3,
  Trash2,
  Plus,
  Loader2,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  saveCustomerAddressAction,
  deleteCustomerAddressAction,
  type SavedCustomerAddress,
  type SaveAddressInput,
} from '@/lib/customer/customer-profile-actions';

interface SavedAddressesCardProps {
  initialAddresses: SavedCustomerAddress[];
  defaultCustomerAddress?: string | null;
}

export function SavedAddressesCard({
  initialAddresses,
  defaultCustomerAddress,
}: SavedAddressesCardProps) {
  const [addresses, setAddresses] = useState<SavedCustomerAddress[]>(initialAddresses);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<SavedCustomerAddress | null>(null);

  // Form states
  const [label, setLabel] = useState<string>('Home');
  const [street, setStreet] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [pincode, setPincode] = useState<string>('');
  const [isDefault, setIsDefault] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const openAddModal = () => {
    setEditingAddress(null);
    setLabel('Home');
    setStreet('');
    setCity('');
    setPincode('');
    setIsDefault(addresses.length === 0);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (addr: SavedCustomerAddress) => {
    setEditingAddress(addr);
    setLabel(addr.label || 'Home');
    setStreet(addr.street || '');
    setCity(addr.city || '');
    setPincode(addr.pincode || '');
    setIsDefault(Boolean(addr.isDefault));
    setFormError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSaving) return;
    setIsModalOpen(false);
    setEditingAddress(null);
    setFormError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanStreet = street.trim();
    const cleanCity = city.trim();
    const cleanPincode = pincode.trim();

    if (!cleanStreet || cleanStreet.length < 3) {
      setFormError('Please enter a street address (at least 3 characters).');
      return;
    }

    if (!cleanCity || cleanCity.length < 2) {
      setFormError('Please enter a city name.');
      return;
    }

    setIsSaving(true);
    try {
      const payload: SaveAddressInput = {
        id: editingAddress?.id,
        label,
        street: cleanStreet,
        city: cleanCity,
        pincode: cleanPincode,
        isDefault,
      };

      const result = await saveCustomerAddressAction(payload);
      if (result.success && result.data) {
        setAddresses(result.data);
        toast.success(
          editingAddress ? 'Address updated successfully!' : 'New address saved!'
        );
        closeModal();
      } else {
        setFormError(result.error || 'Failed to save address.');
      }
    } catch (err) {
      console.error(err);
      setFormError('An unexpected error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const result = await deleteCustomerAddressAction(id);
      if (result.success && result.data) {
        setAddresses(result.data);
        toast.success('Address removed.');
      } else {
        toast.error(result.error || 'Failed to remove address.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not remove address.');
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border/70 p-5 space-y-4">
      {/* Header with Title and Edit/Add Address Pencil Button */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold text-sm text-foreground flex items-center gap-2">
          <MapPin className="size-4 text-primary" />
          <span>Saved Addresses</span>
        </h2>

        {/* Edit / Add Address Header Action */}
        <button
          type="button"
          onClick={openAddModal}
          className="p-2 rounded-xl border border-border/70 hover:border-primary/50 bg-muted/30 hover:bg-muted/70 text-foreground flex items-center justify-center transition-colors cursor-pointer"
          title="Add or Edit Saved Addresses"
          aria-label="Add or Edit Saved Addresses"
        >
          <Edit3 className="size-3.5 text-primary" />
        </button>
      </div>

      {/* Addresses List */}
      {addresses.length === 0 && !defaultCustomerAddress ? (
        <div className="text-center py-6 space-y-3">
          <p className="text-xs text-muted-foreground">
            No saved addresses yet. Add your delivery location for faster checkout.
          </p>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-xs hover:opacity-95 transition-opacity cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>Add Delivery Address</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {addresses.map((addr, idx) => (
            <div
              key={addr.id || idx}
              className="group p-3.5 rounded-xl border border-border/60 hover:border-border bg-muted/20 hover:bg-muted/30 transition-all text-xs space-y-1.5 relative"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-bold text-foreground">
                  {addr.label === 'Work' ? (
                    <Briefcase className="size-3.5 text-primary" />
                  ) : addr.label === 'Other' ? (
                    <MapPin className="size-3.5 text-primary" />
                  ) : (
                    <Home className="size-3.5 text-primary" />
                  )}
                  <span>{addr.label || `Address ${idx + 1}`}</span>
                  {addr.isDefault && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-primary/10 text-primary">
                      Default
                    </span>
                  )}
                </div>

                {/* Edit and Delete Actions for Each Address */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEditModal(addr)}
                    aria-label={`Edit ${addr.label || 'address'}`}
                    title="Edit address"
                    className="p-1.5 rounded-lg border border-border/60 hover:border-primary/40 bg-card hover:bg-muted text-foreground hover:text-primary transition-colors cursor-pointer"
                  >
                    <Edit3 className="size-3.5" />
                  </button>

                  {confirmDeleteId === addr.id ? (
                    <div className="flex items-center gap-1 bg-destructive/10 p-0.5 rounded-lg border border-destructive/20 animate-in fade-in-50 duration-150">
                      <button
                        type="button"
                        onClick={() => addr.id && handleDelete(addr.id)}
                        disabled={deletingId === addr.id}
                        aria-label="Confirm delete address"
                        title="Confirm delete"
                        className="p-1 rounded-md bg-destructive text-destructive-foreground hover:opacity-90 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        {deletingId === addr.id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Check className="size-3" />
                        )}
                        <span>Delete</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        aria-label="Cancel delete"
                        title="Cancel"
                        className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(addr.id || String(idx))}
                      aria-label={`Delete ${addr.label || 'address'}`}
                      title="Delete address"
                      className="p-1.5 rounded-lg border border-border/60 hover:border-destructive/40 bg-card hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <p className="text-muted-foreground pr-16 leading-relaxed">
                {addr.street}, {addr.city} {addr.pincode ? ` - ${addr.pincode}` : ''}
              </p>
            </div>
          ))}

          {/* Fallback for legacy customer.address if addresses array is empty */}
          {addresses.length === 0 && defaultCustomerAddress && (
            <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-foreground">
                  <Home className="size-3.5 text-primary" />
                  <span>Default Delivery Address</span>
                </div>
                <button
                  type="button"
                  onClick={openAddModal}
                  className="p-1.5 rounded-lg border border-border/60 hover:border-primary/40 bg-card hover:bg-muted text-foreground hover:text-primary transition-colors cursor-pointer"
                  title="Edit address"
                >
                  <Edit3 className="size-3.5" />
                </button>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                {defaultCustomerAddress}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modal / Dialog for Add & Edit Address */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-0 duration-200">
          <div
            className="w-full max-w-md bg-card border border-border/80 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-5 animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="address-dialog-title"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Edit3 className="size-4" />
                </div>
                <div>
                  <h3 id="address-dialog-title" className="text-base font-bold text-foreground">
                    {editingAddress ? 'Edit Delivery Address' : 'Add Delivery Address'}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Saved addresses will be available during checkout.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={isSaving}
                className="size-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              {/* Address Label Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Address Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Home', 'Work', 'Other'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setLabel(type)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                        label === type
                          ? 'border-primary bg-primary/10 text-primary font-bold'
                          : 'border-border/70 hover:border-border bg-card text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {type === 'Home' && <Home className="size-3.5" />}
                      {type === 'Work' && <Briefcase className="size-3.5" />}
                      {type === 'Other' && <MapPin className="size-3.5" />}
                      <span>{type}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Street Address */}
              <div className="space-y-1.5">
                <label htmlFor="address-street" className="text-xs font-bold text-foreground">
                  Street Address / House / Flat No. <span className="text-destructive">*</span>
                </label>
                <textarea
                  id="address-street"
                  rows={2}
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="e.g. Flat 402, Sunshine Apartments, 14th Main Road"
                  required
                  disabled={isSaving}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-border/80 bg-background text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all resize-none"
                />
              </div>

              {/* City and Pincode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="address-city" className="text-xs font-bold text-foreground">
                    City <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="address-city"
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Mumbai"
                    required
                    disabled={isSaving}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-border/80 bg-background text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="address-pincode" className="text-xs font-bold text-foreground">
                    PIN Code / Postal Code
                  </label>
                  <input
                    id="address-pincode"
                    type="text"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    placeholder="e.g. 400050"
                    disabled={isSaving}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-border/80 bg-background text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                  />
                </div>
              </div>

              {/* Default Address Checkbox */}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  disabled={isSaving}
                  className="rounded border-border text-primary focus:ring-primary/40 size-4 cursor-pointer"
                />
                <span className="text-xs text-muted-foreground select-none">
                  Set as default delivery address
                </span>
              </label>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSaving}
                  className="px-3.5 py-2 rounded-xl border border-border/80 hover:bg-muted text-xs font-semibold text-foreground transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-primary hover:opacity-95 text-primary-foreground text-xs font-bold flex items-center gap-1.5 shadow-xs transition-opacity cursor-pointer disabled:opacity-60"
                >
                  {isSaving && <Loader2 className="size-3.5 animate-spin" />}
                  <span>{isSaving ? 'Saving...' : editingAddress ? 'Update Address' : 'Save Address'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
