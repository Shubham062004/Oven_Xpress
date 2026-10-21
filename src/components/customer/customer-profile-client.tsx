'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Mail,
  Phone,
  Calendar,
  CheckCircle2,
  ShieldCheck,
  Edit3,
  KeyRound,
  ShoppingBag,
  Heart,
  MapPin,
  Compass,
  LogOut,
  X,
  Loader2,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
} from 'lucide-react';
import { logoutAction } from '@/lib/auth/actions';
import { changePasswordAction } from '@/lib/profile/profile-actions';
import {
  updateCustomerProfileAction,
  type CustomerProfileData,
} from '@/lib/customer/customer-profile-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CustomerProfileClientProps {
  initialData: CustomerProfileData;
}

export function CustomerProfileClient({ initialData }: CustomerProfileClientProps) {
  const [profile, setProfile] = useState<CustomerProfileData>(initialData);

  // Edit Profile Dialog state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState(initialData.name);
  const [editPhone, setEditPhone] = useState(initialData.phone || '');
  const [editAvatarUrl, setEditAvatarUrl] = useState(initialData.avatarUrl || '');
  const [editAddress, setEditAddress] = useState(initialData.defaultAddress || '');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);
  const [isEditPending, startEditTransition] = useTransition();

  // Change Password Dialog state
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isPasswordPending, startPasswordTransition] = useTransition();

  // Calculate Profile Completion Percentage
  const completionItems = [
    { label: 'Full Name', completed: Boolean(profile.name && profile.name.trim().length > 0) },
    { label: 'Email Verified', completed: profile.emailVerified },
    { label: 'Phone Number', completed: Boolean(profile.phone && profile.phone.trim().length >= 10) },
    { label: 'Delivery Address', completed: Boolean(profile.defaultAddress || profile.addresses.length > 0) },
  ];
  const completedCount = completionItems.filter((i) => i.completed).length;
  const completionPercentage = Math.round((completedCount / completionItems.length) * 100);

  const formattedJoinDate = new Date(profile.createdAt).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });

  const handleOpenEdit = () => {
    setEditName(profile.name);
    setEditPhone(profile.phone || '');
    setEditAvatarUrl(profile.avatarUrl || '');
    setEditAddress(profile.defaultAddress || '');
    setEditError(null);
    setEditSuccess(null);
    setIsEditOpen(true);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    setEditSuccess(null);

    startEditTransition(async () => {
      const res = await updateCustomerProfileAction({
        name: editName,
        phone: editPhone || null,
        avatarUrl: editAvatarUrl || null,
        defaultAddress: editAddress || null,
      });

      if (!res.success) {
        setEditError(res.error || 'Failed to update profile.');
      } else if (res.data) {
        setProfile(res.data);
        setEditSuccess('Your profile details were updated successfully!');
        setTimeout(() => {
          setIsEditOpen(false);
        }, 1200);
      }
    });
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    startPasswordTransition(async () => {
      const res = await changePasswordAction({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      if (!res.success) {
        setPasswordError(res.error || 'Failed to update password.');
      } else {
        setPasswordSuccess('Password changed successfully! Other sessions have been signed out.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          setIsPasswordOpen(false);
        }, 1500);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Profile Header Hero Card */}
      <div className="bg-card rounded-3xl border border-border/70 p-6 sm:p-8 shadow-xs flex flex-col md:flex-row items-center md:items-start justify-between gap-6 text-center md:text-left">
        <div className="flex flex-col sm:flex-row items-center gap-5">
          {/* Avatar */}
          {profile.avatarUrl ? (
            <div className="relative size-20 sm:size-24 rounded-3xl overflow-hidden border-2 border-border/80 shadow-lg shadow-orange-500/10 shrink-0">
              <Image
                src={profile.avatarUrl}
                alt={profile.name}
                fill
                sizes="96px"
                className="object-cover"
              />
            </div>
          ) : (
            <div className="size-20 sm:size-24 rounded-3xl bg-linear-to-br from-amber-500 to-orange-600 text-white font-black text-3xl sm:text-4xl flex items-center justify-center shadow-lg shadow-orange-500/25 shrink-0">
              {profile.name.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Details */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                {profile.name}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-wider border border-primary/20">
                Customer
              </span>
            </div>

            <p className="text-xs text-muted-foreground flex items-center justify-center md:justify-start gap-1.5">
              <Mail className="size-3.5 text-primary" />
              <span>{profile.email}</span>
              {profile.emailVerified && (
                <CheckCircle2 className="size-3.5 text-emerald-500 inline ml-1" />
              )}
            </p>

            <p className="text-xs text-muted-foreground flex items-center justify-center md:justify-start gap-1.5">
              <Phone className="size-3.5 text-primary" />
              <span>{profile.phone || 'No phone number provided'}</span>
            </p>

            <p className="text-[11px] text-muted-foreground/80 flex items-center justify-center md:justify-start gap-1.5 pt-0.5">
              <Calendar className="size-3 text-muted-foreground/60" />
              <span>Customer since {formattedJoinDate}</span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 shrink-0">
          <Button
            type="button"
            onClick={handleOpenEdit}
            className="font-bold text-xs shadow-xs"
          >
            <Edit3 className="size-3.5 mr-1.5" />
            <span>Edit Profile</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setPasswordError(null);
              setPasswordSuccess(null);
              setIsPasswordOpen(true);
            }}
            className="font-semibold text-xs"
          >
            <KeyRound className="size-3.5 mr-1.5" />
            <span>Change Password</span>
          </Button>

          <form action={logoutAction}>
            <Button
              type="submit"
              variant="ghost"
              className="font-semibold text-xs text-destructive hover:bg-destructive/10"
            >
              <LogOut className="size-3.5 mr-1.5" />
              <span>Sign Out</span>
            </Button>
          </form>
        </div>
      </div>

      {/* Profile Completion Indicator */}
      <div className="bg-card rounded-2xl border border-border/70 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" />
            <h2 className="font-bold text-sm text-foreground">Profile Status</h2>
          </div>
          <span className="font-black text-xs text-primary">{completionPercentage}% Completed</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-linear-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          {completionItems.map((item) => (
            <div
              key={item.label}
              className={`flex items-center gap-1.5 text-xs font-medium ${
                item.completed ? 'text-foreground' : 'text-muted-foreground/70'
              }`}
            >
              <CheckCircle2
                className={`size-3.5 shrink-0 ${
                  item.completed ? 'text-emerald-500' : 'text-muted-foreground/40'
                }`}
              />
              <span className="text-[11px] truncate">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Customer Quick Shortcuts Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Wishlist Shortcut */}
        <Link
          href="/account/wishlist"
          className="group p-5 rounded-2xl border border-border/70 hover:border-amber-500/50 bg-card hover:bg-amber-500/5 transition-all space-y-2 block"
        >
          <div className="flex items-center justify-between">
            <div className="size-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Heart className="size-5 fill-amber-500/20 text-amber-500" />
            </div>
            <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
              My Wishlist
            </h3>
            <p className="text-xs text-muted-foreground">
              {profile.wishlistCount} saved {profile.wishlistCount === 1 ? 'item' : 'items'} in your favorites collection
            </p>
          </div>
        </Link>

        {/* My Orders Shortcut */}
        <Link
          href="/account/orders"
          className="group p-5 rounded-2xl border border-border/70 hover:border-primary/50 bg-card hover:bg-primary/5 transition-all space-y-2 block"
        >
          <div className="flex items-center justify-between">
            <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <ShoppingBag className="size-5" />
            </div>
            <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
              My Orders
            </h3>
            <p className="text-xs text-muted-foreground">
              {profile.ordersCount} previous {profile.ordersCount === 1 ? 'order' : 'orders'} placed with Oven Xpress
            </p>
          </div>
        </Link>

        {/* Track Active Order */}
        <Link
          href="/track"
          className="group p-5 rounded-2xl border border-border/70 hover:border-emerald-500/50 bg-card hover:bg-emerald-500/5 transition-all space-y-2 block"
        >
          <div className="flex items-center justify-between">
            <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Compass className="size-5" />
            </div>
            <ArrowRight className="size-4 text-muted-foreground group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground group-hover:text-emerald-500 transition-colors">
              Track Order
            </h3>
            <p className="text-xs text-muted-foreground">
              Follow real-time status of your active food preparation and delivery
            </p>
          </div>
        </Link>
      </div>

      {/* Address Details Section */}
      <div className="bg-card rounded-2xl border border-border/70 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="size-4 text-primary" />
            <h2 className="font-bold text-sm text-foreground">Delivery Address Details</h2>
          </div>
          <Button variant="ghost" size="xs" onClick={handleOpenEdit} className="text-xs text-primary font-bold">
            Edit Address
          </Button>
        </div>

        {profile.defaultAddress || profile.addresses.length > 0 ? (
          <div className="space-y-2.5">
            {profile.defaultAddress && (
              <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20 text-xs space-y-1">
                <span className="font-bold text-foreground block">Default Delivery Address</span>
                <p className="text-muted-foreground leading-relaxed">{profile.defaultAddress}</p>
              </div>
            )}
            {profile.addresses.map((addr, idx) => (
              <div key={addr.id || idx} className="p-3.5 rounded-xl border border-border/60 bg-muted/20 text-xs space-y-1">
                <span className="font-bold text-foreground block">{addr.label || `Address ${idx + 1}`}</span>
                <p className="text-muted-foreground">{addr.street}, {addr.city} {addr.pincode}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-dashed border-border text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              No delivery address saved yet. Add your default address for faster checkout.
            </p>
            <Button size="xs" variant="outline" onClick={handleOpenEdit} className="text-xs">
              Add Delivery Address
            </Button>
          </div>
        )}
      </div>

      {/* ================= EDIT PROFILE MODAL ================= */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-md bg-card rounded-3xl border border-border/80 shadow-2xl p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="font-bold text-lg text-foreground">Edit Profile</h3>
                <p className="text-xs text-muted-foreground">Update your personal contact information</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="size-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                aria-label="Close dialog"
              >
                <X className="size-4" />
              </button>
            </div>

            {editError && (
              <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            {editSuccess && (
              <div className="rounded-xl border border-emerald-500/50 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>{editSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name" className="text-xs font-semibold">
                  Full Name *
                </Label>
                <Input
                  id="edit-name"
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Your full name"
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-phone" className="text-xs font-semibold">
                  Mobile Phone Number
                </Label>
                <Input
                  id="edit-phone"
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="text-xs h-9"
                />
                <p className="text-[10px] text-muted-foreground">
                  Used for order updates and SMS delivery coordination.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-address" className="text-xs font-semibold">
                  Default Delivery Address
                </Label>
                <textarea
                  id="edit-address"
                  rows={2}
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  placeholder="Flat/House No, Building, Street, Area..."
                  className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-avatar" className="text-xs font-semibold">
                  Profile Photo URL (Optional)
                </Label>
                <Input
                  id="edit-avatar"
                  type="url"
                  value={editAvatarUrl}
                  onChange={(e) => setEditAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="text-xs h-9"
                />
                <p className="text-[10px] text-muted-foreground">
                  Supports Google Profile photos or custom HTTPS image links.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditOpen(false)}
                  disabled={isEditPending}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isEditPending}
                  className="text-xs font-bold"
                >
                  {isEditPending ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin mr-1.5" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= CHANGE PASSWORD MODAL ================= */}
      {isPasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-md bg-card rounded-3xl border border-border/80 shadow-2xl p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="font-bold text-lg text-foreground">Change Password</h3>
                <p className="text-xs text-muted-foreground">Update your account login security password</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPasswordOpen(false)}
                className="size-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                aria-label="Close dialog"
              >
                <X className="size-4" />
              </button>
            </div>

            {passwordError && (
              <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="rounded-xl border border-emerald-500/50 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="current-pw" className="text-xs font-semibold">
                  Current Password *
                </Label>
                <div className="relative">
                  <Input
                    id="current-pw"
                    type={showCurrent ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="text-xs h-9 pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showCurrent ? 'Hide password' : 'Show password'}
                  >
                    {showCurrent ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-pw" className="text-xs font-semibold">
                  New Password *
                </Label>
                <div className="relative">
                  <Input
                    id="new-pw"
                    type={showNew ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="text-xs h-9 pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showNew ? 'Hide password' : 'Show password'}
                  >
                    {showNew ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Must contain uppercase, lowercase, numbers, and special characters.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-pw" className="text-xs font-semibold">
                  Confirm New Password *
                </Label>
                <Input
                  id="confirm-pw"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="text-xs h-9"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPasswordOpen(false)}
                  disabled={isPasswordPending}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPasswordPending}
                  className="text-xs font-bold"
                >
                  {isPasswordPending ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin mr-1.5" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <span>Update Password</span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
