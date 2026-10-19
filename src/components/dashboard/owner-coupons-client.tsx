'use client';

import React, { useState, useMemo, useTransition } from 'react';
import {
  Tag,
  Plus,
  Search,
  Copy,
  Check,
  Users,
  ShoppingBag,
  Building2,
  Percent,
  IndianRupee,
  Cake,
  Gift,
  Trash2,
  Power,
  X,
  Clock,
  Eye,
  Loader2,
  Sparkles,
} from 'lucide-react';
import {
  createCouponAction,
  toggleCouponStatusAction,
  deleteCouponAction,
  type CouponWithStats,
  type CreateCouponInput,
} from '@/lib/coupons/coupon-actions';
import type { CouponDiscountType, CouponUserFilter } from '@/lib/coupons/coupon-types';
import { toast } from 'sonner';

interface BranchOption {
  id: string;
  name: string;
  city: string;
}

interface TargetableUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  joinedAt: string;
  orderCount: number;
}

interface OwnerCouponsClientProps {
  initialCoupons: CouponWithStats[];
  branches: BranchOption[];
  targetableUsers: TargetableUser[];
}

export function OwnerCouponsClient({
  initialCoupons,
  branches,
  targetableUsers,
}: OwnerCouponsClientProps) {
  const [coupons, setCoupons] = useState<CouponWithStats[]>(initialCoupons);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | CouponDiscountType>('ALL');

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedCouponForUsage, setSelectedCouponForUsage] = useState<CouponWithStats | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  // Create Form State
  const [formData, setFormData] = useState<{
    code: string;
    title: string;
    description: string;
    discountType: CouponDiscountType;
    discountValue: number;
    minOrderAmount: number;
    maxDiscountAmount: number | '';
    freeItemName: string;
    requiresInstruction: boolean;
    instructionPrompt: string;
    allBranches: boolean;
    branchIds: string[];
    userFilter: CouponUserFilter;
    targetedUserIds: string[];
    maxUsesPerUser: number | '';
    totalMaxUses: number | '';
    isActive: boolean;
  }>({
    code: '',
    title: '',
    description: '',
    discountType: 'FIXED_AMOUNT',
    discountValue: 50,
    minOrderAmount: 150,
    maxDiscountAmount: '',
    freeItemName: '',
    requiresInstruction: false,
    instructionPrompt: 'Name on cake / Birthday message',
    allBranches: true,
    branchIds: [],
    userFilter: 'ALL_USERS',
    targetedUserIds: [],
    maxUsesPerUser: 1,
    totalMaxUses: '',
    isActive: true,
  });

  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Overall KPI statistics
  const stats = useMemo(() => {
    const total = coupons.length;
    const active = coupons.filter((c) => c.isActive).length;
    const totalRedemptions = coupons.reduce((sum, c) => sum + c.totalUsages, 0);
    const totalSavingsDisbursed = coupons.reduce((sum, c) => sum + c.totalDiscountGiven, 0);
    const uniqueUsersSet = new Set<string>();
    coupons.forEach((c) => {
      c.usages.forEach((u) => {
        if (u.customerPhone) uniqueUsersSet.add(u.customerPhone);
        else if (u.customerEmail) uniqueUsersSet.add(u.customerEmail);
      });
    });

    return {
      total,
      active,
      inactive: total - active,
      totalRedemptions,
      totalSavingsDisbursed,
      uniqueUsers: uniqueUsersSet.size,
    };
  }, [coupons]);

  // Filtered coupons list
  const filteredCoupons = useMemo(() => {
    return coupons.filter((c) => {
      if (statusFilter === 'ACTIVE' && !c.isActive) return false;
      if (statusFilter === 'INACTIVE' && c.isActive) return false;
      if (typeFilter !== 'ALL' && c.discountType !== typeFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCode = c.code.toLowerCase().includes(q);
        const matchesTitle = c.title.toLowerCase().includes(q);
        const matchesDesc = c.description?.toLowerCase().includes(q);
        if (!matchesCode && !matchesTitle && !matchesDesc) return false;
      }
      return true;
    });
  }, [coupons, statusFilter, typeFilter, searchQuery]);

  // Copy code helper
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Copied code "${code}" to clipboard!`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Toggle active/inactive
  const handleToggleStatus = (coupon: CouponWithStats) => {
    const nextStatus = !coupon.isActive;
    startTransition(async () => {
      const res = await toggleCouponStatusAction(coupon.id, nextStatus);
      if (res.success) {
        setCoupons((prev) =>
          prev.map((c) => (c.id === coupon.id ? { ...c, isActive: nextStatus } : c))
        );
        toast.success(`Coupon "${coupon.code}" is now ${nextStatus ? 'ACTIVE' : 'INACTIVE'}`);
      } else {
        toast.error(res.error || 'Failed to update coupon status');
      }
    });
  };

  // Delete coupon
  const handleDeleteCoupon = (coupon: CouponWithStats) => {
    if (
      !confirm(
        `Are you sure you want to delete coupon "${coupon.code}"? This will permanently remove it from the system.`
      )
    ) {
      return;
    }

    startTransition(async () => {
      const res = await deleteCouponAction(coupon.id);
      if (res.success) {
        setCoupons((prev) => prev.filter((c) => c.id !== coupon.id));
        if (selectedCouponForUsage?.id === coupon.id) {
          setSelectedCouponForUsage(null);
        }
        toast.success(`Coupon "${coupon.code}" deleted successfully`);
      } else {
        toast.error(res.error || 'Failed to delete coupon');
      }
    });
  };

  // Submit Create Coupon
  const handleCreateCouponSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.code.trim()) {
      toast.error('Coupon code is required');
      return;
    }
    if (!formData.title.trim()) {
      toast.error('Coupon title is required');
      return;
    }
    if (formData.minOrderAmount < 0) {
      toast.error('Minimum order amount must be 0 or greater');
      return;
    }
    if (!formData.allBranches && formData.branchIds.length === 0) {
      toast.error('Please select at least one branch or enable "All Branches"');
      return;
    }
    if (formData.userFilter === 'SPECIFIC_USERS' && formData.targetedUserIds.length === 0) {
      toast.error('Please select at least one specific user or change audience filter');
      return;
    }

    const payload: CreateCouponInput = {
      code: formData.code.trim().toUpperCase(),
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      discountType: formData.discountType,
      discountValue: Number(formData.discountValue || 0),
      minOrderAmount: Number(formData.minOrderAmount || 0),
      maxDiscountAmount:
        formData.maxDiscountAmount !== '' ? Number(formData.maxDiscountAmount) : undefined,
      freeItemName: formData.freeItemName.trim() || undefined,
      requiresInstruction: formData.requiresInstruction,
      instructionPrompt: formData.instructionPrompt.trim() || undefined,
      allBranches: formData.allBranches,
      branchIds: formData.branchIds,
      userFilter: formData.userFilter,
      targetedUserIds: formData.targetedUserIds,
      maxUsesPerUser:
        formData.maxUsesPerUser !== '' ? Number(formData.maxUsesPerUser) : undefined,
      totalMaxUses:
        formData.totalMaxUses !== '' ? Number(formData.totalMaxUses) : undefined,
      isActive: formData.isActive,
    };

    startTransition(async () => {
      const res = await createCouponAction(payload);
      if (res.success && res.couponId) {
        toast.success(`Coupon "${payload.code}" created successfully!`);
        setIsCreateModalOpen(false);

        // Optimistically construct new item
        const newCoupon: CouponWithStats = {
          id: res.couponId,
          code: payload.code,
          title: payload.title,
          description: payload.description || null,
          discountType: payload.discountType,
          discountValue: payload.discountValue,
          minOrderAmount: payload.minOrderAmount,
          maxDiscountAmount: payload.maxDiscountAmount || null,
          freeItemName: payload.freeItemName || null,
          requiresInstruction: payload.requiresInstruction || false,
          instructionPrompt: payload.instructionPrompt || null,
          allBranches: payload.allBranches,
          branchIds: payload.branchIds || [],
          userFilter: payload.userFilter,
          targetedUserIds: payload.targetedUserIds || [],
          maxUsesPerUser: payload.maxUsesPerUser || null,
          totalMaxUses: payload.totalMaxUses || null,
          isActive: payload.isActive ?? true,
          startDate: null,
          endDate: null,
          createdAt: new Date().toISOString(),
          totalUsages: 0,
          uniqueUsersCount: 0,
          totalDiscountGiven: 0,
          usages: [],
          userUsageSummary: [],
        };
        setCoupons((prev) => [newCoupon, ...prev]);

        // Reset form
        setFormData({
          code: '',
          title: '',
          description: '',
          discountType: 'FIXED_AMOUNT',
          discountValue: 50,
          minOrderAmount: 150,
          maxDiscountAmount: '',
          freeItemName: '',
          requiresInstruction: false,
          instructionPrompt: 'Name on cake / Birthday message',
          allBranches: true,
          branchIds: [],
          userFilter: 'ALL_USERS',
          targetedUserIds: [],
          maxUsesPerUser: 1,
          totalMaxUses: '',
          isActive: true,
        });
      } else {
        toast.error(res.error || 'Failed to create coupon');
      }
    });
  };

  // Preset Template loader
  const handleLoadTemplate = (template: 'FIRST50' | 'BIRTHDAY') => {
    if (template === 'FIRST50') {
      setFormData((prev) => ({
        ...prev,
        code: 'FIRST50',
        title: 'Flat ₹50 OFF on First Order',
        description: 'Exclusive welcome offer on first order above ₹150',
        discountType: 'FIXED_AMOUNT',
        discountValue: 50,
        minOrderAmount: 150,
        maxDiscountAmount: '',
        freeItemName: '',
        requiresInstruction: false,
        allBranches: true,
        branchIds: [],
        userFilter: 'FIRST_ORDER_ONLY',
        maxUsesPerUser: 1,
        totalMaxUses: '',
        isActive: true,
      }));
    } else if (template === 'BIRTHDAY') {
      setFormData((prev) => ({
        ...prev,
        code: 'BIRTHDAY',
        title: 'Complimentary Birthday Cake with Order',
        description: 'Celebrate your birthday with a free gourmet cake on orders above ₹1,500',
        discountType: 'FREE_ITEM',
        discountValue: 0,
        minOrderAmount: 1500,
        maxDiscountAmount: '',
        freeItemName: 'Free Birthday Cake',
        requiresInstruction: true,
        instructionPrompt: 'Name on cake / Birthday message',
        allBranches: true,
        branchIds: [],
        userFilter: 'ALL_USERS',
        maxUsesPerUser: '',
        totalMaxUses: '',
        isActive: true,
      }));
    }
  };

  const filteredTargetUsers = useMemo(() => {
    if (!userSearchQuery.trim()) return targetableUsers;
    const q = userSearchQuery.toLowerCase();
    return targetableUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone && u.phone.includes(q))
    );
  }, [targetableUsers, userSearchQuery]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Banner / Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Coupons & Promotions Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              Owner Portal
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Configure discount coupons, audience filters, branch availability, and inspect who used each coupon.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-md hover:bg-primary/90 transition-all active:scale-[0.98] shrink-0"
        >
          <Plus className="size-4" />
          <span>Create New Coupon</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-card p-4 rounded-2xl border border-border/80 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-semibold">Active / Total</span>
            <Tag className="size-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-foreground">
            {stats.active} <span className="text-xs font-normal text-muted-foreground">/ {stats.total}</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {stats.inactive} inactive promotional offers
          </div>
        </div>

        <div className="bg-card p-4 rounded-2xl border border-border/80 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-semibold">Total Redemptions</span>
            <ShoppingBag className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-foreground">
            {stats.totalRedemptions}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-0.5">
            Successful customer orders
          </div>
        </div>

        <div className="bg-card p-4 rounded-2xl border border-border/80 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-semibold">Unique Customers</span>
            <Users className="size-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-foreground">
            {stats.uniqueUsers}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Benefited from discounts & free items
          </div>
        </div>

        <div className="bg-card p-4 rounded-2xl border border-border/80 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-semibold">Total Savings Disbursed</span>
            <IndianRupee className="size-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-foreground">
            ₹{stats.totalSavingsDisbursed.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Discounts & complimentary items value
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-card p-3 rounded-2xl border border-border/80">
        <div className="relative w-full sm:w-80">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search code, title or note..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-muted/40 border border-border/70 rounded-xl focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border/60 text-xs">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({coupons.length})
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                statusFilter === 'ACTIVE'
                  ? 'bg-background text-emerald-600 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Active ({stats.active})
            </button>
            <button
              onClick={() => setStatusFilter('INACTIVE')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                statusFilter === 'INACTIVE'
                  ? 'bg-background text-muted-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Inactive ({stats.inactive})
            </button>
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'ALL' | CouponDiscountType)}
            className="px-3 py-1.5 text-xs bg-muted/50 border border-border/70 rounded-xl focus:outline-none focus:border-primary font-medium text-foreground"
          >
            <option value="ALL">All Types</option>
            <option value="FIXED_AMOUNT">Flat Amount (₹)</option>
            <option value="PERCENTAGE">Percentage (%)</option>
            <option value="FREE_ITEM">Free Item / Cake</option>
          </select>
        </div>
      </div>

      {/* Coupons List / Grid */}
      {filteredCoupons.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed border-border p-10 text-center space-y-3">
          <div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
            <Tag className="size-6" />
          </div>
          <h3 className="font-bold text-base text-foreground">No coupons found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {searchQuery
              ? `No coupons match "${searchQuery}". Try adjusting your search or filters.`
              : 'Get started by creating your first promotional coupon or loading templates.'}
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-xs hover:bg-primary/90"
          >
            <Plus className="size-3.5" />
            <span>Create Coupon</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCoupons.map((coupon) => {
            const isFirst50 = coupon.code === 'FIRST50';
            const isBirthday = coupon.code === 'BIRTHDAY';

            return (
              <div
                key={coupon.id}
                className={`bg-card rounded-2xl border p-4 sm:p-5 flex flex-col justify-between transition-all hover:shadow-md ${
                  coupon.isActive
                    ? 'border-border/80 shadow-xs'
                    : 'border-border/40 opacity-75 bg-muted/20'
                }`}
              >
                <div className="space-y-3">
                  {/* Card Header: Code pill & status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1 bg-primary/10 border border-primary/20 text-primary px-2.5 py-1 rounded-lg font-mono font-black text-sm tracking-wider">
                        <span>{coupon.code}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyCode(coupon.code)}
                          className="hover:text-primary/70 transition-colors ml-1"
                          title="Copy Code"
                        >
                          {copiedCode === coupon.code ? (
                            <Check className="size-3 text-emerald-600" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                        </button>
                      </div>

                      {isFirst50 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">
                          1st Order
                        </span>
                      )}
                      {isBirthday && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 border border-purple-500/20 flex items-center gap-1">
                          <Cake className="size-3" /> Free Cake
                        </span>
                      )}
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        coupon.isActive
                          ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                          : 'bg-muted text-muted-foreground border border-border'
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          coupon.isActive ? 'bg-emerald-500' : 'bg-muted-foreground'
                        }`}
                      />
                      {coupon.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Discount Highlight */}
                  <div>
                    <h3 className="font-bold text-sm text-foreground line-clamp-1">{coupon.title}</h3>
                    {coupon.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {coupon.description}
                      </p>
                    )}
                  </div>

                  {/* Discount Value Badge */}
                  <div className="flex items-center gap-2 pt-1">
                    {coupon.discountType === 'FIXED_AMOUNT' && (
                      <div className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold text-xs flex items-center gap-1">
                        <IndianRupee className="size-3" />
                        <span>Flat ₹{coupon.discountValue} OFF</span>
                      </div>
                    )}
                    {coupon.discountType === 'PERCENTAGE' && (
                      <div className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold text-xs flex items-center gap-1">
                        <Percent className="size-3" />
                        <span>
                          {coupon.discountValue}% OFF
                          {coupon.maxDiscountAmount ? ` (Up to ₹${coupon.maxDiscountAmount})` : ''}
                        </span>
                      </div>
                    )}
                    {coupon.discountType === 'FREE_ITEM' && (
                      <div className="px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-700 dark:text-purple-400 font-bold text-xs flex items-center gap-1">
                        <Gift className="size-3" />
                        <span>Free Item: {coupon.freeItemName || 'Special Gift'}</span>
                      </div>
                    )}

                    <span className="text-[11px] text-muted-foreground font-medium">
                      Min Order: ₹{coupon.minOrderAmount}
                    </span>
                  </div>

                  {/* Rule details list */}
                  <div className="space-y-1.5 text-[11px] text-muted-foreground border-t border-border/50 pt-2.5">
                    {/* Audience Restriction */}
                    <div className="flex items-center gap-1.5">
                      <Users className="size-3 text-muted-foreground/80 shrink-0" />
                      <span>
                        Audience:{' '}
                        <strong className="text-foreground">
                          {coupon.userFilter === 'ALL_USERS' && 'All Customers'}
                          {coupon.userFilter === 'FIRST_ORDER_ONLY' && 'First Order Customers Only'}
                          {coupon.userFilter === 'JOINED_LAST_10_DAYS' && 'Users joined in last 10 days'}
                          {coupon.userFilter === 'JOINED_LAST_30_DAYS' && 'Users joined in last 30 days'}
                          {coupon.userFilter === 'SPECIFIC_USERS' &&
                            `Selected Users (${coupon.targetedUserIds.length})`}
                        </strong>
                      </span>
                    </div>

                    {/* Branch Restriction */}
                    <div className="flex items-center gap-1.5">
                      <Building2 className="size-3 text-muted-foreground/80 shrink-0" />
                      <span>
                        Branches:{' '}
                        <strong className="text-foreground">
                          {coupon.allBranches
                            ? 'All Branches'
                            : `${coupon.branchIds.length} Selected Branch(es)`}
                        </strong>
                      </span>
                    </div>

                    {/* Cake / Instruction requirement */}
                    {coupon.requiresInstruction && (
                      <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
                        <Cake className="size-3 shrink-0" />
                        <span>Requires customer note: &ldquo;{coupon.instructionPrompt}&rdquo;</span>
                      </div>
                    )}

                    {/* Max Uses */}
                    <div className="flex items-center gap-1.5">
                      <Clock className="size-3 text-muted-foreground/80 shrink-0" />
                      <span>
                        Limit:{' '}
                        <strong className="text-foreground">
                          {coupon.maxUsesPerUser
                            ? `${coupon.maxUsesPerUser} use(s) per user`
                            : 'Multiple uses allowed'}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* Real-time Usage Analytics Bar */}
                  <div className="bg-muted/40 rounded-xl p-2.5 flex items-center justify-between text-xs border border-border/50">
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                        Used By
                      </div>
                      <div className="font-bold text-foreground">
                        {coupon.totalUsages} times{' '}
                        <span className="text-[11px] font-normal text-muted-foreground">
                          ({coupon.uniqueUsersCount} users)
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                        Total Saved
                      </div>
                      <div className="font-bold text-emerald-600">
                        ₹{coupon.totalDiscountGiven.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-4 border-t border-border/50 mt-4 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCouponForUsage(coupon)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary/80 text-secondary-foreground hover:bg-secondary font-semibold text-xs transition-colors"
                  >
                    <Eye className="size-3.5" />
                    <span>Who Used This? ({coupon.totalUsages})</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleToggleStatus(coupon)}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        coupon.isActive
                          ? 'border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10'
                          : 'border-muted text-muted-foreground hover:bg-muted'
                      }`}
                      title={coupon.isActive ? 'Deactivate Coupon' : 'Activate Coupon'}
                    >
                      <Power className="size-3.5" />
                    </button>

                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleDeleteCoupon(coupon)}
                      className="p-1.5 rounded-lg border border-destructive/20 text-destructive hover:bg-destructive/10 transition-colors"
                      title="Delete Coupon"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: WHO USED THIS COUPON (DETAILED ANALYTICS) */}
      {/* ======================================================== */}
      {selectedCouponForUsage && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card w-full max-w-3xl rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Users className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-black text-foreground">
                      Coupon Usage & Users Breakdown
                    </h2>
                    <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                      {selectedCouponForUsage.code}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Detailed record of all customers who claimed this promotional offer
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCouponForUsage(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-5">
              {/* Stats overview in modal */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-muted/40 border border-border text-center">
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">
                    Total Uses
                  </div>
                  <div className="text-xl font-black text-foreground">
                    {selectedCouponForUsage.totalUsages}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-muted/40 border border-border text-center">
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">
                    Unique Customers
                  </div>
                  <div className="text-xl font-black text-foreground">
                    {selectedCouponForUsage.uniqueUsersCount}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-muted/40 border border-border text-center">
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">
                    Total Discount Disbursed
                  </div>
                  <div className="text-xl font-black text-emerald-600">
                    ₹{selectedCouponForUsage.totalDiscountGiven.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Per-User Summary: Who used it and how many times */}
              <div>
                <h4 className="font-bold text-xs uppercase text-muted-foreground tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Users className="size-3.5 text-primary" />
                  <span>Users & Frequency of Use</span>
                </h4>

                {selectedCouponForUsage.userUsageSummary.length === 0 ? (
                  <div className="p-6 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
                    No customers have applied this coupon yet.
                  </div>
                ) : (
                  <div className="border border-border rounded-xl overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                        <tr>
                          <th className="py-2.5 px-3">Customer Identifier</th>
                          <th className="py-2.5 px-3 text-center">Times Used</th>
                          <th className="py-2.5 px-3 text-right">Total Saved</th>
                          <th className="py-2.5 px-3 text-right">Last Used Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {selectedCouponForUsage.userUsageSummary.map((item, idx) => (
                          <tr key={idx} className="hover:bg-muted/20">
                            <td className="py-2.5 px-3 font-semibold text-foreground">
                              {item.identifier}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold">
                              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono text-[11px]">
                                {item.count} {item.count === 1 ? 'time' : 'times'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                              ₹{item.totalSaved.toLocaleString('en-IN')}
                            </td>
                            <td className="py-2.5 px-3 text-right text-muted-foreground">
                              {new Date(item.lastUsed).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Detailed Orders Log */}
              {selectedCouponForUsage.usages.length > 0 && (
                <div>
                  <h4 className="font-bold text-xs uppercase text-muted-foreground tracking-wider mb-2.5 flex items-center gap-1.5">
                    <ShoppingBag className="size-3.5 text-emerald-500" />
                    <span>Order Redemption Log & Customer Instructions</span>
                  </h4>

                  <div className="space-y-2">
                    {selectedCouponForUsage.usages.map((u) => (
                      <div
                        key={u.id}
                        className="p-3 rounded-xl border border-border bg-card hover:border-border/80 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-primary">
                              #{u.orderNumber || 'Pending Order'}
                            </span>
                            <span className="text-muted-foreground">•</span>
                            <span className="font-medium text-foreground">
                              {u.customerName || 'Guest User'}
                            </span>
                            {u.customerPhone && (
                              <span className="text-muted-foreground text-[11px]">
                                ({u.customerPhone})
                              </span>
                            )}
                          </div>

                          <div className="font-bold text-emerald-600">
                            -₹{u.discountAmount.toFixed(2)}
                          </div>
                        </div>

                        {/* Special Instruction (e.g. Birthday Cake Name!) */}
                        {u.instruction && (
                          <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-800 dark:text-purple-300 flex items-start gap-1.5 text-xs">
                            <Cake className="size-3.5 mt-0.5 shrink-0" />
                            <div>
                              <span className="font-semibold">Customer Cake Instruction / Message: </span>
                              <span className="font-medium italic">&ldquo;{u.instruction}&rdquo;</span>
                            </div>
                          </div>
                        )}

                        <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                          <span>
                            {new Date(u.createdAt).toLocaleString('en-IN', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </span>
                          {u.customerEmail && <span>{u.customerEmail}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border bg-muted/20 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedCouponForUsage(null)}
                className="px-4 py-2 rounded-xl bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-secondary/80"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: CREATE NEW COUPON */}
      {/* ======================================================== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Tag className="size-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-foreground">
                    Create New Promotional Coupon
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Set up discount rules, branch eligibility, and targeted user cohorts
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateCouponSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4">
              {/* Quick Template Buttons */}
              <div className="p-3 rounded-xl bg-muted/30 border border-border/80 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                  <Sparkles className="size-3.5 text-primary" />
                  <span>Quick Setup Templates:</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleLoadTemplate('FIRST50')}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-500/10 text-blue-600 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                  >
                    FIRST50 (₹50 Off 1st Order)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadTemplate('BIRTHDAY')}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-purple-500/10 text-purple-600 border border-purple-500/20 hover:bg-purple-500/20 transition-colors flex items-center gap-1"
                  >
                    <Cake className="size-3" />
                    <span>BIRTHDAY (Free Cake)</span>
                  </button>
                </div>
              </div>

              {/* Code & Title */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-foreground">
                    Coupon Code <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. FIRST50, BIRTHDAY, FESTIVE20"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value.toUpperCase() })
                    }
                    className="w-full px-3 py-2 bg-muted/40 border border-border/80 rounded-xl focus:outline-none focus:border-primary font-mono font-bold tracking-wider uppercase"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground">
                    Title / Offer Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Flat ₹50 OFF on First Order"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 bg-muted/40 border border-border/80 rounded-xl focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1 text-xs">
                <label className="font-bold text-foreground">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Valid on your first order above ₹150 across select branches"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-muted/40 border border-border/80 rounded-xl focus:outline-none focus:border-primary"
                />
              </div>

              {/* Discount Type & Values */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-foreground">Discount Type</label>
                  <select
                    value={formData.discountType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        discountType: e.target.value as CouponDiscountType,
                      })
                    }
                    className="w-full px-3 py-2 bg-muted/40 border border-border/80 rounded-xl focus:outline-none focus:border-primary font-medium"
                  >
                    <option value="FIXED_AMOUNT">Flat Amount (₹)</option>
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FREE_ITEM">Free Item / Cake</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground">
                    {formData.discountType === 'PERCENTAGE'
                      ? 'Discount %'
                      : formData.discountType === 'FREE_ITEM'
                      ? 'Item Value (₹, optional)'
                      : 'Discount Value (₹)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.discountValue}
                    onChange={(e) =>
                      setFormData({ ...formData, discountValue: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-muted/40 border border-border/80 rounded-xl focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground">
                    Minimum Order Subtotal (₹) <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    placeholder="150"
                    value={formData.minOrderAmount}
                    onChange={(e) =>
                      setFormData({ ...formData, minOrderAmount: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-muted/40 border border-border/80 rounded-xl focus:outline-none focus:border-primary font-bold"
                  />
                </div>
              </div>

              {/* Free Item / Cake settings */}
              {formData.discountType === 'FREE_ITEM' && (
                <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/20 space-y-3 text-xs">
                  <div className="font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                    <Cake className="size-4" />
                    <span>Free Item & Special Instruction Settings</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-semibold text-foreground">Free Item Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Free Birthday Cake"
                        value={formData.freeItemName}
                        onChange={(e) => setFormData({ ...formData, freeItemName: e.target.value })}
                        className="w-full px-3 py-2 bg-background border border-border/80 rounded-xl focus:outline-none focus:border-primary"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-foreground">
                        Customer Prompt / Instruction Label
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Name on cake / Birthday message"
                        value={formData.instructionPrompt}
                        onChange={(e) =>
                          setFormData({ ...formData, instructionPrompt: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-background border border-border/80 rounded-xl focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={formData.requiresInstruction}
                      onChange={(e) =>
                        setFormData({ ...formData, requiresInstruction: e.target.checked })
                      }
                      className="rounded text-primary focus:ring-primary size-4"
                    />
                    <span className="font-semibold text-foreground">
                      Ask customer for instruction / name on cake before checkout
                    </span>
                  </label>
                </div>
              )}

              {/* Branch Selection Checkboxes */}
              <div className="space-y-2 text-xs border-t border-border/60 pt-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-foreground flex items-center gap-1.5">
                    <Building2 className="size-3.5 text-primary" />
                    <span>Branch Availability</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-foreground">
                    <input
                      type="checkbox"
                      checked={formData.allBranches}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          allBranches: e.target.checked,
                          branchIds: e.target.checked ? [] : formData.branchIds,
                        })
                      }
                      className="rounded text-primary focus:ring-primary size-4"
                    />
                    <span>Show in All Branches</span>
                  </label>
                </div>

                {!formData.allBranches && (
                  <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-2">
                    <div className="text-[11px] text-muted-foreground font-medium">
                      Select which specific branches this coupon is valid at:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto">
                      {branches.map((b) => {
                        const isChecked = formData.branchIds.includes(b.id);
                        return (
                          <label
                            key={b.id}
                            className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                              isChecked
                                ? 'bg-primary/10 border-primary/30 text-foreground font-semibold'
                                : 'bg-background border-border/80 text-muted-foreground'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData({
                                    ...formData,
                                    branchIds: [...formData.branchIds, b.id],
                                  });
                                } else {
                                  setFormData({
                                    ...formData,
                                    branchIds: formData.branchIds.filter((id) => id !== b.id),
                                  });
                                }
                              }}
                              className="rounded text-primary focus:ring-primary"
                            />
                            <span>
                              {b.name} <span className="text-[10px] text-muted-foreground">({b.city})</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Target Audience & Join Date Cohort Filters */}
              <div className="space-y-2 text-xs border-t border-border/60 pt-3">
                <label className="font-bold text-foreground flex items-center gap-1.5">
                  <Users className="size-3.5 text-blue-500" />
                  <span>Target Audience & Customer Filter</span>
                </label>

                <select
                  value={formData.userFilter}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      userFilter: e.target.value as CouponUserFilter,
                    })
                  }
                  className="w-full px-3 py-2 bg-muted/40 border border-border/80 rounded-xl focus:outline-none focus:border-primary font-medium"
                >
                  <option value="ALL_USERS">All Users (Open to all customers)</option>
                  <option value="FIRST_ORDER_ONLY">First Order Only (User has 0 confirmed orders)</option>
                  <option value="JOINED_LAST_10_DAYS">New Users: Joined within last 10 days</option>
                  <option value="JOINED_LAST_30_DAYS">Recent Users: Joined within last 30 days</option>
                  <option value="SPECIFIC_USERS">Selected Users (Select specific customer accounts)</option>
                </select>

                {/* Specific Users Picker */}
                {formData.userFilter === 'SPECIFIC_USERS' && (
                  <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] text-muted-foreground font-medium">
                        Select specific customers ({formData.targetedUserIds.length} selected):
                      </div>
                      <input
                        type="text"
                        placeholder="Search users..."
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        className="px-2 py-1 text-[11px] bg-background border border-border rounded-lg"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                      {filteredTargetUsers.map((u) => {
                        const isChecked = formData.targetedUserIds.includes(u.id);
                        return (
                          <label
                            key={u.id}
                            className={`flex items-start gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                              isChecked
                                ? 'bg-primary/10 border-primary/30 text-foreground font-semibold'
                                : 'bg-background border-border/80 text-muted-foreground'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData({
                                    ...formData,
                                    targetedUserIds: [...formData.targetedUserIds, u.id],
                                  });
                                } else {
                                  setFormData({
                                    ...formData,
                                    targetedUserIds: formData.targetedUserIds.filter(
                                      (id) => id !== u.id
                                    ),
                                  });
                                }
                              }}
                              className="rounded text-primary focus:ring-primary mt-0.5"
                            />
                            <div className="leading-tight">
                              <div>{u.name}</div>
                              <div className="text-[10px] text-muted-foreground">
                                {u.phone || u.email} • {u.orderCount} orders
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Usage Limits & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs border-t border-border/60 pt-3">
                <div className="space-y-1">
                  <label className="font-bold text-foreground">
                    Max Uses Per Customer (Leave empty for unlimited)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 1 (for 1-time coupons)"
                    value={formData.maxUsesPerUser}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        maxUsesPerUser: e.target.value === '' ? '' : Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 bg-muted/40 border border-border/80 rounded-xl focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground">
                    Total Maximum Redemptions (Optional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 500"
                    value={formData.totalMaxUses}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        totalMaxUses: e.target.value === '' ? '' : Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 bg-muted/40 border border-border/80 rounded-xl focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 text-xs">
                <input
                  type="checkbox"
                  id="isActiveCoupon"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded text-primary focus:ring-primary size-4"
                />
                <label htmlFor="isActiveCoupon" className="font-semibold text-foreground cursor-pointer">
                  Activate this coupon immediately after creation
                </label>
              </div>

              {/* Actions */}
              <div className="p-4 border-t border-border bg-muted/20 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-secondary/80"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-md hover:bg-primary/90 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Creating Coupon...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="size-3.5" />
                      <span>Create Coupon</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
