'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  AlertTriangle,
  Loader2,
  Pencil,
  Plus,
  Minus,
  Utensils,
  ShoppingBag,
  Truck,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import { OrderType, OrderStatus } from '@prisma/client';

import { getOrderById, updateOrder } from '@/lib/orders/actions';
import type { OrderDetail } from '@/lib/orders/types';
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

interface OrderEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  onSuccess: () => void;
}

interface EditableItem {
  menuItemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  notes: string;
}

export function OrderEditDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  onSuccess,
}: OrderEditDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [isLoadingOrder, setIsLoadingOrder] = useState(true);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Editable Form Fields
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [notes, setNotes] = useState('');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [deliveryCharge, setDeliveryCharge] = useState<number>(0);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Load Order Details when dialog mounts or orderId changes
  useEffect(() => {
    let ignore = false;

    getOrderById(orderId)
      .then((res) => {
        if (ignore) return;
        setIsLoadingOrder(false);

        if (res.success && res.data) {
          const ord = res.data;
          setOrder(ord);

          if (ord.status !== OrderStatus.PENDING) {
            setFetchError(
              `Cannot edit order ${ord.orderNumber}. Only PENDING orders can be edited (current status: ${ord.status}).`
            );
            return;
          }

          setCustomerName(ord.customerName || ord.customer?.name || '');
          setCustomerPhone(ord.customerPhone || ord.customer?.phone || '');
          setDeliveryAddress(ord.deliveryAddress || ord.customer?.address || '');
          setDeliveryNotes(ord.deliveryNotes || '');
          setNotes(ord.notes || '');
          setDiscountAmount(ord.discountAmount || 0);
          setDeliveryCharge(ord.deliveryCharge || 0);
          setItems(
            ord.items.map((i) => ({
              menuItemId: i.menuItemId,
              itemName: i.itemName,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              discountAmount: i.discountAmount,
              notes: i.notes || '',
            }))
          );
        } else {
          setFetchError(res.error || 'Failed to load order details');
        }
      })
      .catch((err) => {
        if (ignore) return;
        setIsLoadingOrder(false);
        console.error(err);
        setFetchError('Failed to fetch order details');
      });

    return () => {
      ignore = true;
    };
  }, [orderId]);

  // Adjust item quantity
  const handleQuantityChange = (index: number, delta: number) => {
    setItems((prev) => {
      const copy = [...prev];
      const target = copy[index];
      const newQty = target.quantity + delta;
      if (newQty <= 0) {
        if (copy.length <= 1) {
          toast.error('An order must have at least one item');
          return prev;
        }
        copy.splice(index, 1);
      } else {
        copy[index] = { ...target, quantity: newQty };
      }
      return copy;
    });
  };

  // Local recalculation for live preview
  const subtotal = items.reduce((sum, item) => {
    const itemTotal = Math.max(0, item.unitPrice * item.quantity - (item.discountAmount || 0));
    return sum + itemTotal;
  }, 0);
  const tax = Math.round(subtotal * 0.05 * 100) / 100;
  const appliedDiscount = Math.min(discountAmount || 0, subtotal);
  const appliedDelivery = order?.orderType === OrderType.DELIVERY ? deliveryCharge || 0 : 0;
  const grandTotal = Math.max(0, subtotal - appliedDiscount + tax + appliedDelivery);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    if (items.length === 0) {
      setValidationError('Order must contain at least one item.');
      return;
    }

    if (order.orderType === OrderType.DELIVERY && !deliveryAddress.trim()) {
      setValidationError('Delivery address is required for Delivery orders.');
      return;
    }

    setValidationError(null);
    startTransition(async () => {
      const res = await updateOrder(orderId, {
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        deliveryAddress: deliveryAddress.trim() || undefined,
        deliveryNotes: deliveryNotes.trim() || undefined,
        notes: notes.trim() || undefined,
        discountAmount: appliedDiscount,
        deliveryCharge: appliedDelivery,
        items: items.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          discountAmount: i.discountAmount,
          notes: i.notes || undefined,
        })),
      });

      if (res.success) {
        toast.success(`Order "${orderNumber}" updated successfully.`);
        onOpenChange(false);
        onSuccess();
      } else {
        setValidationError(res.error || 'Failed to update order');
        toast.error(res.error || 'Failed to update order');
      }
    });
  };

  const getTypeIcon = (type: OrderType) => {
    switch (type) {
      case OrderType.DINE_IN:
        return <Utensils className="size-3 text-primary" />;
      case OrderType.TAKEAWAY:
        return <ShoppingBag className="size-3 text-amber-500" />;
      case OrderType.DELIVERY:
        return <Truck className="size-3 text-blue-500" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-foreground">
            <div className="p-1.5 rounded-md bg-primary/10 text-primary">
              <Pencil className="size-4 shrink-0" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Edit Order {orderNumber}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Update customer details, items, and instructions. Authoritative totals and taxes are recalculated on save.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isLoadingOrder ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="text-xs">Loading order details...</p>
          </div>
        ) : fetchError ? (
          <div className="py-6 space-y-4">
            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Unable to edit order</p>
                <p className="mt-1 text-destructive/90">{fetchError}</p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : order ? (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {/* Order meta bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-muted/40 border border-border/50 text-xs">
              <div className="flex items-center gap-1.5 font-medium">
                <Building2 className="size-3.5 text-muted-foreground" />
                <span>{order.branch.name}</span>
                <span className="text-muted-foreground">({order.branch.code})</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1 text-[11px]">
                  {getTypeIcon(order.orderType)}
                  {order.orderType}
                  {order.table?.tableNumber ? ` • Table ${order.table.tableNumber}` : ''}
                </Badge>
                <Badge className="bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30 text-[11px]">
                  {order.status}
                </Badge>
              </div>
            </div>

            {validationError && (
              <div className="p-2.5 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                {validationError}
              </div>
            )}

            {/* Customer Contact */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="customerName" className="text-xs font-medium">
                  Customer Name
                </Label>
                <Input
                  id="customerName"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="text-xs h-8"
                  disabled={isPending}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="customerPhone" className="text-xs font-medium">
                  Customer Phone
                </Label>
                <Input
                  id="customerPhone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  className="text-xs h-8"
                  disabled={isPending}
                />
              </div>
            </div>

            {/* Delivery fields if order is delivery */}
            {order.orderType === OrderType.DELIVERY && (
              <div className="space-y-3 p-3 rounded-lg bg-muted/20 border border-border/40">
                <div className="space-y-1.5">
                  <Label htmlFor="deliveryAddress" className="text-xs font-medium">
                    Delivery Address <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="deliveryAddress"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Enter full street address, apartment, landmarks..."
                    className="text-xs min-h-[60px]"
                    disabled={isPending}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="deliveryNotes" className="text-xs font-medium">
                    Delivery Instructions
                  </Label>
                  <Input
                    id="deliveryNotes"
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    placeholder="e.g. Ring the doorbell, leave at front desk"
                    className="text-xs h-8"
                    disabled={isPending}
                  />
                </div>
              </div>
            )}

            {/* Items Management */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Ordered Items ({items.length})</Label>
                <span className="text-[11px] text-muted-foreground">Adjust quantities</span>
              </div>

              <div className="border border-border/50 rounded-lg divide-y divide-border/40 max-h-44 overflow-y-auto">
                {items.map((item, idx) => (
                  <div key={item.menuItemId + idx} className="p-2.5 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate text-foreground">{item.itemName}</p>
                      <p className="text-[11px] text-muted-foreground">
                        ₹{item.unitPrice.toFixed(2)} each
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center border border-border/60 rounded-md">
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(idx, -1)}
                          disabled={isPending}
                          className="px-2 py-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                          title="Decrease quantity"
                        >
                          <Minus className="size-3" />
                        </button>
                        <span className="px-2 text-xs font-semibold">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(idx, 1)}
                          disabled={isPending}
                          className="px-2 py-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                          title="Increase quantity"
                        >
                          <Plus className="size-3" />
                        </button>
                      </div>

                      <span className="w-16 text-right font-semibold">
                        ₹{(item.unitPrice * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Special Instructions & Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="orderNotes" className="text-xs font-medium">
                Order Notes / Special Instructions
              </Label>
              <Input
                id="orderNotes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Extra napkins, less spicy, allergic to nuts"
                className="text-xs h-8"
                disabled={isPending}
              />
            </div>

            {/* Financial Summary Preview */}
            <div className="p-3 rounded-lg bg-muted/40 border border-border/50 text-xs space-y-1.5">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal:</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>GST / Taxes (5%):</span>
                <span>₹{tax.toFixed(2)}</span>
              </div>
              {appliedDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Discount:</span>
                  <span>-₹{appliedDiscount.toFixed(2)}</span>
                </div>
              )}
              {appliedDelivery > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Delivery Charge:</span>
                  <span>₹{appliedDelivery.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm text-foreground pt-1 border-t border-border/40">
                <span>Estimated Total:</span>
                <span>₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                size="sm"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} size="sm">
                {isPending && <Loader2 className="mr-2 size-3.5 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
