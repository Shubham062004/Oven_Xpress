'use client';

import { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Utensils,
  ShoppingBag,
  Truck,
  Search,
  Plus,
  Minus,
  Trash2,
  Building2,
  Clock,
  User,
  Phone,
  MapPin,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { OrderType, TableStatus } from '@prisma/client';

import { createOrder, getBranchMenuItems } from '@/lib/orders/actions';
import { getBranchTables } from '@/lib/tables/actions';
import { lookupCustomerByPhone, type CustomerSummary } from '@/lib/customers/actions';
import type { BranchMenuItemOption } from '@/lib/orders/types';
import type { TableItem } from '@/lib/tables/types';

import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface BranchOption {
  id: string;
  name: string;
  code: string;
}

interface OrderFormClientProps {
  branches: BranchOption[];
  userBranchId?: string | null;
  isManager: boolean;
  initialTables: TableItem[];
  initialMenuItems: BranchMenuItemOption[];
}

interface CartItem {
  menuItemId: string;
  itemName: string;
  unitPrice: number;
  quantity: number;
  discountAmount: number;
  notes: string;
  categoryName: string;
}

export function OrderFormClient({
  branches,
  userBranchId,
  isManager,
  initialTables,
  initialMenuItems,
}: OrderFormClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Selected branch
  const [branchId, setBranchId] = useState<string>(
    userBranchId || (branches.length > 0 ? branches[0].id : '')
  );

  // Dynamic tables & menu items state for selected branch
  const [tables, setTables] = useState<TableItem[]>(initialTables);
  const [menuItems, setMenuItems] = useState<BranchMenuItemOption[]>(initialMenuItems);
  const [isLoadingBranchData, setIsLoadingBranchData] = useState<boolean>(false);

  // Order configuration
  const [orderType, setOrderType] = useState<OrderType>(OrderType.DINE_IN);
  const [selectedTableId, setSelectedTableId] = useState<string>('');

  // Customer information
  const [customerId, setCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [deliveryNotes, setDeliveryNotes] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Customer phone lookup state
  const [lookupResult, setLookupResult] = useState<CustomerSummary | null>(null);
  const [isLookingUp, setIsLookingUp] = useState<boolean>(false);

  // Financial adjustments
  const [orderDiscount, setOrderDiscount] = useState<string>('0');
  const [deliveryCharge, setDeliveryCharge] = useState<string>('0');

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);

  // Menu filtering & search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Handle branch change: fetch branch menu items & tables
  const handleBranchChange = async (newBranchId: string) => {
    if (newBranchId === branchId) return;

    if (cart.length > 0) {
      const confirmClear = window.confirm(
        'Changing the branch will reset your cart because item pricing and availability are branch-specific. Do you want to continue?'
      );
      if (!confirmClear) return;
    }

    setBranchId(newBranchId);
    setSelectedTableId('');
    setCart([]);
    setIsLoadingBranchData(true);

    try {
      const [itemsRes, tablesRes] = await Promise.all([
        getBranchMenuItems(newBranchId),
        getBranchTables(newBranchId),
      ]);

      if (itemsRes.success && itemsRes.data) {
        setMenuItems(itemsRes.data);
      } else {
        toast.error('Failed to load menu items for selected branch');
      }

      if (tablesRes.success && tablesRes.data) {
        setTables(tablesRes.data);
      } else {
        toast.error('Failed to load tables for selected branch');
      }
    } catch {
      toast.error('Error switching branch');
    } finally {
      setIsLoadingBranchData(false);
    }
  };

  // Adjust delivery charge default when switching order type
  const handleOrderTypeChange = (type: OrderType) => {
    setOrderType(type);
    if (type === OrderType.DELIVERY && (deliveryCharge === '0' || deliveryCharge === '')) {
      setDeliveryCharge('50'); // Standard default delivery fee
    } else if (type !== OrderType.DELIVERY) {
      setDeliveryCharge('0');
    }
  };

  // Customer phone lookup handler
  const handlePhoneBlur = async () => {
    if (!customerPhone || customerPhone.trim().length < 4) {
      setLookupResult(null);
      return;
    }

    setIsLookingUp(true);
    try {
      const res = await lookupCustomerByPhone(customerPhone.trim());
      if (res.success && res.data) {
        setLookupResult(res.data);
      } else {
        setLookupResult(null);
      }
    } catch {
      setLookupResult(null);
    } finally {
      setIsLookingUp(false);
    }
  };

  const applyCustomerLookup = (cust: CustomerSummary) => {
    setCustomerId(cust.id);
    setCustomerName(cust.name);
    if (cust.address && orderType === OrderType.DELIVERY && !deliveryAddress) {
      setDeliveryAddress(cust.address);
    }
    toast.success(`Loaded customer details for ${cust.name}`);
  };

  // Distinct categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    menuItems.forEach((m) => {
      if (m.categoryName) set.add(m.categoryName);
    });
    return Array.from(set).sort();
  }, [menuItems]);

  // Filtered menu items
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesCategory =
        selectedCategory === 'ALL' || item.categoryName === selectedCategory;
      const matchesSearch =
        !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  // Cart operations
  const addToCart = (item: BranchMenuItemOption) => {
    if (!item.isAvailable) {
      toast.error(`"${item.name}" is currently unavailable at this branch`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.menuItemId === item.id);
      if (existing) {
        return prev.map((i) =>
          i.menuItemId === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          menuItemId: item.id,
          itemName: item.name,
          unitPrice: item.price,
          quantity: 1,
          discountAmount: 0,
          notes: '',
          categoryName: item.categoryName,
        },
      ];
    });
  };

  const updateQuantity = (menuItemId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((i) => {
          if (i.menuItemId === menuItemId) {
            const newQty = i.quantity + delta;
            return newQty > 0 ? { ...i, quantity: newQty } : null;
          }
          return i;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const updateItemNotes = (menuItemId: string, notesVal: string) => {
    setCart((prev) =>
      prev.map((i) => (i.menuItemId === menuItemId ? { ...i, notes: notesVal } : i))
    );
  };

  const removeFromCart = (menuItemId: string) => {
    setCart((prev) => prev.filter((i) => i.menuItemId !== menuItemId));
  };

  // Calculations (Live Client Preview; Server enforces authoritative values)
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const lineTotal = item.quantity * item.unitPrice - (item.discountAmount || 0);
      return sum + Math.max(0, lineTotal);
    }, 0);
  }, [cart]);

  const discountNum = Math.min(parseFloat(orderDiscount) || 0, subtotal);
  const taxNum = Math.round(subtotal * 0.05 * 100) / 100;
  const deliveryNum = orderType === OrderType.DELIVERY ? parseFloat(deliveryCharge) || 0 : 0;
  const grandTotal = Math.max(0, subtotal - discountNum + taxNum + deliveryNum);

  // Available tables for DINE_IN
  const availableTables = useMemo(() => {
    return tables.filter((t) => t.status === TableStatus.AVAILABLE || t.id === selectedTableId);
  }, [tables, selectedTableId]);

  // Form Submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!branchId) {
      toast.error('Please select a branch');
      return;
    }

    if (cart.length === 0) {
      toast.error('Please add at least one item to the order');
      return;
    }

    if (orderType === OrderType.DINE_IN && !selectedTableId) {
      toast.error('Dine-in orders require an available dining table selection');
      return;
    }

    if (orderType === OrderType.DELIVERY) {
      if (!customerName.trim()) {
        toast.error('Customer name is required for delivery orders');
        return;
      }
      if (!customerPhone.trim()) {
        toast.error('Customer phone is required for delivery orders');
        return;
      }
      if (!deliveryAddress.trim()) {
        toast.error('Delivery address is required for delivery orders');
        return;
      }
    }

    startTransition(async () => {
      const res = await createOrder({
        branchId,
        orderType,
        tableId: orderType === OrderType.DINE_IN ? selectedTableId : undefined,
        customerId: customerId || undefined,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        deliveryAddress: orderType === OrderType.DELIVERY ? deliveryAddress.trim() : undefined,
        deliveryNotes: orderType === OrderType.DELIVERY ? deliveryNotes.trim() || undefined : undefined,
        discountAmount: discountNum,
        deliveryCharge: deliveryNum,
        notes: notes.trim() || undefined,
        items: cart.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          discountAmount: item.discountAmount || 0,
          notes: item.notes.trim() || undefined,
        })),
      });

      if (res.success && res.data) {
        toast.success(`Order ${res.data.orderNumber} created successfully!`);
        router.push(`/orders/${res.data.id}`);
      } else {
        toast.error(res.error || 'Failed to create order');
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/orders"
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Orders
          </Link>
          <PageHeader
            title="Create New Order"
            description="Fast restaurant POS order creation for Dine-In, Takeaway, and Delivery."
          />
        </div>

        {/* Branch Selector Bar */}
        <div className="flex items-center gap-3 bg-muted/40 p-2 rounded-xl border">
          <Building2 className="h-5 w-5 text-muted-foreground ml-2" />
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              Operating Branch
            </span>
            {isManager && userBranchId ? (
              <span className="text-sm font-bold text-foreground">
                {branches.find((b) => b.id === userBranchId)?.name || 'Assigned Branch'}
              </span>
            ) : (
              <Select value={branchId} onValueChange={(val) => { if (val) handleBranchChange(val); }} disabled={isPending}>
                <SelectTrigger className="h-8 w-[200px] border-none bg-transparent shadow-none font-semibold focus:ring-0 p-0 text-foreground">
                  <SelectValue placeholder="Select Branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </div>

      {/* Main 2-Column POS Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Order Type, Item Catalog & Selection (7 or 8 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Order Type Pills */}
          <Card className="shadow-xs border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Order Type
                </span>
                <div className="grid grid-cols-3 gap-2 w-full max-w-md">
                  <button
                    type="button"
                    onClick={() => handleOrderTypeChange(OrderType.DINE_IN)}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                      orderType === OrderType.DINE_IN
                        ? 'bg-amber-500 text-white shadow-sm font-semibold'
                        : 'bg-muted hover:bg-muted/80 text-foreground'
                    }`}
                  >
                    <Utensils className="h-4 w-4" />
                    Dine-In
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOrderTypeChange(OrderType.TAKEAWAY)}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                      orderType === OrderType.TAKEAWAY
                        ? 'bg-blue-600 text-white shadow-sm font-semibold'
                        : 'bg-muted hover:bg-muted/80 text-foreground'
                    }`}
                  >
                    <ShoppingBag className="h-4 w-4" />
                    Takeaway
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOrderTypeChange(OrderType.DELIVERY)}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                      orderType === OrderType.DELIVERY
                        ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                        : 'bg-muted hover:bg-muted/80 text-foreground'
                    }`}
                  >
                    <Truck className="h-4 w-4" />
                    Delivery
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dine-In Table Selection Section */}
          {orderType === OrderType.DINE_IN && (
            <Card className="border-amber-200 dark:border-amber-900/40 bg-amber-500/5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
                    <Utensils className="h-4 w-4 text-amber-500" />
                    Select Dining Table <span className="text-destructive">*</span>
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {availableTables.length} tables available
                  </span>
                </div>
                <CardDescription>
                  Choose an available dining table for this order. It will be marked occupied upon order creation.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {tables.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground bg-background rounded-lg border">
                    No tables configured for this branch. Please add dining tables first.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                    {tables.map((table) => {
                      const isSelected = selectedTableId === table.id;
                      const isOccupied =
                        table.status !== TableStatus.AVAILABLE && !isSelected;

                      return (
                        <button
                          key={table.id}
                          type="button"
                          disabled={isOccupied}
                          onClick={() => setSelectedTableId(table.id)}
                          className={`relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center ${
                            isSelected
                              ? 'border-amber-500 bg-amber-500 text-white shadow-md'
                              : isOccupied
                              ? 'opacity-50 bg-muted/60 border-dashed cursor-not-allowed text-muted-foreground'
                              : 'bg-card hover:border-amber-400 hover:shadow-xs text-foreground'
                          }`}
                        >
                          <span className="text-sm font-bold">{table.tableNumber}</span>
                          <span
                            className={`text-[10px] mt-0.5 ${
                              isSelected ? 'text-amber-100' : 'text-muted-foreground'
                            }`}
                          >
                            {table.capacity} Seats
                          </span>
                          <span
                            className={`text-[9px] uppercase tracking-wider font-semibold mt-1 px-1.5 py-0.2 rounded ${
                              isSelected
                                ? 'bg-white/20 text-white'
                                : table.status === TableStatus.AVAILABLE
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'bg-red-500/10 text-red-600 dark:text-red-400'
                            }`}
                          >
                            {table.status}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Customer Details Box (Conditional styling based on order type) */}
          <Card className="border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  Customer Information
                  {orderType === OrderType.DELIVERY && (
                    <Badge variant="destructive" className="text-[10px] h-4">
                      Required for Delivery
                    </Badge>
                  )}
                  {orderType !== OrderType.DELIVERY && (
                    <span className="text-xs font-normal text-muted-foreground">
                      (Optional / Guest)
                    </span>
                  )}
                </CardTitle>
                {isLookingUp && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse">
                    <Loader2 className="h-3 w-3 animate-spin" /> Looking up phone...
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Phone Lookup Banner */}
              {lookupResult && (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-semibold">{lookupResult.name}</span>
                      <span className="text-muted-foreground ml-1.5">
                        ({lookupResult.totalOrders} previous orders)
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-emerald-500/50 hover:bg-emerald-500/20"
                    onClick={() => applyCustomerLookup(lookupResult)}
                  >
                    Auto-Fill
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="customerPhone" className="text-xs">
                    Customer Phone {orderType === OrderType.DELIVERY && <span className="text-destructive">*</span>}
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="customerPhone"
                      placeholder="e.g. 9876543210"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      onBlur={handlePhoneBlur}
                      className="pl-9 h-9 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="customerName" className="text-xs">
                    Customer Name {orderType === OrderType.DELIVERY && <span className="text-destructive">*</span>}
                  </Label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="customerName"
                      placeholder="e.g. John Doe"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="pl-9 h-9 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Delivery Address & Instructions */}
              {orderType === OrderType.DELIVERY && (
                <div className="space-y-3 pt-2 border-t">
                  <div className="space-y-1.5">
                    <Label htmlFor="deliveryAddress" className="text-xs">
                      Delivery Address <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="deliveryAddress"
                        placeholder="Street, Building, Flat / Apt number"
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        className="pl-9 h-9 text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="deliveryNotes" className="text-xs">
                      Landmark / Delivery Instructions
                    </Label>
                    <Input
                      id="deliveryNotes"
                      placeholder="e.g. Ring bell twice, leave at door, near supermarket"
                      value={deliveryNotes}
                      onChange={(e) => setDeliveryNotes(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Menu Catalog Section */}
          <Card className="border shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Utensils className="h-4 w-4 text-primary" />
                  Select Menu Items
                </CardTitle>

                {/* Search Bar */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search menu items..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-sm"
                  />
                </div>
              </div>

              {/* Category Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-2 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('ALL')}
                  className={`text-xs px-3 py-1 rounded-full font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === 'ALL'
                      ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                      : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                  }`}
                >
                  All Items ({menuItems.length})
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`text-xs px-3 py-1 rounded-full font-medium whitespace-nowrap transition-colors ${
                      selectedCategory === cat
                        ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                        : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </CardHeader>

            <CardContent>
              {isLoadingBranchData ? (
                <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Loading branch menu items...</span>
                </div>
              ) : filteredMenuItems.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground border rounded-xl bg-muted/20">
                  No menu items found matching your filters.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {filteredMenuItems.map((item) => {
                    const cartEntry = cart.find((i) => i.menuItemId === item.id);
                    const qtyInCart = cartEntry ? cartEntry.quantity : 0;

                    return (
                      <div
                        key={item.id}
                        className={`group flex flex-col justify-between p-3 rounded-xl border bg-card hover:shadow-sm transition-all ${
                          !item.isAvailable
                            ? 'opacity-60 bg-muted/40 border-dashed'
                            : qtyInCart > 0
                            ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20'
                            : ''
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-1">
                            <span className="text-sm font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                              {item.name}
                            </span>
                            {!item.isAvailable && (
                              <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">
                                Unavailable
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground line-clamp-1">
                              {item.categoryName}
                            </span>
                            {item.preparationTimeMinutes && (
                              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {item.preparationTimeMinutes}m
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 mt-2 border-t">
                          <span className="text-sm font-bold text-foreground">
                            ₹{item.price.toFixed(2)}
                          </span>

                          {item.isAvailable ? (
                            qtyInCart > 0 ? (
                              <div className="flex items-center gap-1 bg-background border rounded-lg p-0.5 shadow-2xs">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.id, -1)}
                                  className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="w-5 text-center text-xs font-bold">
                                  {qtyInCart}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => addToCart(item)}
                                  className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 px-2.5 text-xs gap-1 font-medium hover:bg-primary hover:text-primary-foreground"
                                onClick={() => addToCart(item)}
                              >
                                <Plus className="h-3 w-3" /> Add
                              </Button>
                            )
                          ) : (
                            <span className="text-[11px] text-muted-foreground italic">Sold Out</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Order Cart / Summary (4 or 5 cols) */}
        <div className="lg:col-span-5 sticky top-6 space-y-4">
          <Card className="border shadow-md">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-primary" />
                    Current Order ({cart.reduce((s, i) => s + i.quantity, 0)} items)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Review and finalize items before placing the order.
                  </CardDescription>
                </div>
                {cart.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => setCart([])}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-4 max-h-[420px] overflow-y-auto">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Utensils className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-sm font-medium">Cart is empty</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Select menu items from the catalog on the left to begin.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 divide-y">
                  {cart.map((item) => {
                    const lineTotal = item.quantity * item.unitPrice - (item.discountAmount || 0);

                    return (
                      <div key={item.menuItemId} className="pt-3 first:pt-0 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-sm font-semibold text-foreground">
                              {item.itemName}
                            </span>
                            <div className="text-xs text-muted-foreground">
                              ₹{item.unitPrice.toFixed(2)} each
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-sm font-bold text-foreground">
                              ₹{Math.max(0, lineTotal).toFixed(2)}
                            </span>
                            {item.discountAmount > 0 && (
                              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                                -₹{item.discountAmount.toFixed(2)} off
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Quantity and Line Actions */}
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <div className="flex items-center gap-1.5 bg-muted/60 rounded-md p-0.5">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.menuItemId, -1)}
                              className="h-6 w-6 flex items-center justify-center rounded hover:bg-background text-muted-foreground hover:text-foreground"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-6 text-center text-xs font-bold">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.menuItemId, 1)}
                              className="h-6 w-6 flex items-center justify-center rounded hover:bg-background text-muted-foreground hover:text-foreground"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <Input
                              placeholder="Notes (e.g. extra cheese)"
                              value={item.notes}
                              onChange={(e) => updateItemNotes(item.menuItemId, e.target.value)}
                              className="h-7 text-xs w-36 sm:w-44"
                            />
                            <button
                              type="button"
                              onClick={() => removeFromCart(item.menuItemId)}
                              className="text-muted-foreground hover:text-destructive p-1"
                              title="Remove item"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>

            {/* Financial Adjustments & Totals Summary */}
            <CardFooter className="flex flex-col gap-3 p-4 bg-muted/20 border-t">
              {/* Discounts and Charges Row */}
              <div className="grid grid-cols-2 gap-3 w-full">
                <div className="space-y-1">
                  <Label htmlFor="orderDiscount" className="text-[11px] text-muted-foreground">
                    Discount (₹)
                  </Label>
                  <Input
                    id="orderDiscount"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={orderDiscount}
                    onChange={(e) => setOrderDiscount(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                {orderType === OrderType.DELIVERY && (
                  <div className="space-y-1">
                    <Label htmlFor="deliveryCharge" className="text-[11px] text-muted-foreground">
                      Delivery Charge (₹)
                    </Label>
                    <Input
                      id="deliveryCharge"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="50.00"
                      value={deliveryCharge}
                      onChange={(e) => setDeliveryCharge(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                )}
              </div>

              {/* Order Notes */}
              <div className="w-full space-y-1">
                <Label htmlFor="orderNotes" className="text-[11px] text-muted-foreground">
                  Order Kitchen / Operational Notes
                </Label>
                <Input
                  id="orderNotes"
                  placeholder="Special instructions or prep requirements..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              {/* Summary Totals Table */}
              <div className="w-full space-y-1.5 pt-2 border-t text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>

                {discountNum > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                    <span>Order Discount</span>
                    <span>-₹{discountNum.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between text-muted-foreground">
                  <span>Tax (5% GST/Food Tax)</span>
                  <span>₹{taxNum.toFixed(2)}</span>
                </div>

                {orderType === OrderType.DELIVERY && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Delivery Charge</span>
                    <span>₹{deliveryNum.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between text-base font-bold text-foreground pt-2 border-t">
                  <span>Total Amount</span>
                  <span className="text-primary text-lg">₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isPending || cart.length === 0}
                className="w-full h-10 mt-1 font-semibold text-sm shadow-sm gap-2"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating Order...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Place Order (₹{grandTotal.toFixed(2)})
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
