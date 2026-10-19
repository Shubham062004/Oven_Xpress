'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MapPin,
  User,
  CreditCard,
  Smartphone,
  Banknote,
  ShieldCheck,
  Loader2,
  ArrowRight,
  AlertCircle,
  Home,
  Briefcase,
  PackageCheck,
} from 'lucide-react';
import { useCart } from '@/context/cart-context';
import { createCustomerOrderAction } from '@/lib/customer/order-actions';
import {
  initiateRazorpayOrderAction,
  verifyAndCompleteRazorpayPaymentAction,
} from '@/lib/customer/razorpay-actions';
import {
  loadRazorpayScript,
  type RazorpayPaymentSuccessPayload,
} from '@/lib/payments/razorpay-client';
import { RazorpayMockModal } from '@/components/payments/razorpay-mock-modal';
import { toast } from 'sonner';

interface SavedAddress {
  id?: string;
  label?: string;
  street: string;
  city: string;
  state?: string;
  pincode?: string;
  landmark?: string;
  isDefault?: boolean;
}

interface CheckoutClientProps {
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
  };
  savedAddresses: SavedAddress[];
  defaultCustomerAddress?: string | null;
}

export function CheckoutClient({
  user,
  savedAddresses,
  defaultCustomerAddress,
}: CheckoutClientProps) {
  const router = useRouter();
  const {
    items,
    branch,
    orderType,
    tableNumber,
    appliedCoupon,
    itemCount,
    subtotal,
    tax,
    deliveryFee,
    discount,
    total,
    clearCart,
  } = useCart();

  const [customerName, setCustomerName] = useState(user.name || '');
  const [customerPhone, setCustomerPhone] = useState(user.phone || '');
  
  // Address selection
  const initialAddress =
    savedAddresses[0]
      ? `${savedAddresses[0].street}, ${savedAddresses[0].city}`
      : defaultCustomerAddress || '';

  const [selectedAddressIndex, setSelectedAddressIndex] = useState<number>(
    savedAddresses.length > 0 ? 0 : -1
  );
  const [customAddress, setCustomAddress] = useState(initialAddress);
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'ONLINE' | 'CARD'>('UPI');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingLabel, setSubmittingLabel] = useState<string>('Placing Your Order...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);


  // Mock modal state for testing/demo environments without live keys
  const [mockModalOpen, setMockModalOpen] = useState(false);
  const [mockOrderDetails, setMockOrderDetails] = useState<{
    orderId: string;
    orderNumber: string;
    amount: number;
    razorpayOrderId: string;
    trackingToken?: string;
  } | null>(null);

  if (items.length === 0) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <p className="text-base font-bold">Your cart is empty.</p>
        <Link
          href="/"
          className="inline-block px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs"
        >
          Return to Menu
        </Link>
      </div>
    );
  }

  // Opens the official Razorpay Checkout modal
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openRazorpayCheckout = async (initResult: any) => {
    setSubmittingLabel('Launching Razorpay...');
    setIsSubmitting(true);

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || !window.Razorpay) {
        setErrorMessage('Failed to load Razorpay Checkout SDK. Please check your internet connection.');
        setIsSubmitting(false);
        return;
      }

      const options = {
        key: initResult.keyId || '',
        amount: initResult.amount || 0,
        currency: initResult.currency || 'INR',
        name: 'Oven Xpress',
        description: `Order #${initResult.orderNumber}`,
        image: '/images/hero-pizza.jpg',
        order_id: initResult.razorpayOrderId,
        handler: async (response: RazorpayPaymentSuccessPayload) => {
          setSubmittingLabel('Verifying Payment...');
          setIsSubmitting(true);
          try {
            const verifyResult = await verifyAndCompleteRazorpayPaymentAction({
              orderId: initResult.orderId!,
              orderNumber: initResult.orderNumber!,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              trackingToken: initResult.trackingToken,
            });

            if (verifyResult.success && verifyResult.trackingUrl) {
              clearCart();
              toast.success('Payment verified & order confirmed!');
              router.push(verifyResult.trackingUrl);
            } else {
              setErrorMessage(
                verifyResult.error || 'Payment verification failed. Please contact support.'
              );
              setIsSubmitting(false);
            }
          } catch (verifyErr) {
            console.error('Verification error:', verifyErr);
            setErrorMessage('Error verifying payment. Please do not re-pay and check order status.');
            setIsSubmitting(false);
          }
        },
        prefill: {
          name: customerName,
          contact: customerPhone,
          email: initResult.customerEmail || user.email || '',
        },
        notes: {
          orderNumber: initResult.orderNumber || '',
          branchId: branch?.id || '',
        },
        theme: {
          color: '#ea580c', // Oven Xpress Brand Orange
        },
        modal: {
          ondismiss: () => {
            setIsSubmitting(false);
            toast.info('Payment was cancelled or dismissed. Your cart is preserved.');
          },
        },
      };

      const rzpInstance = new window.Razorpay(options);
      rzpInstance.open();
    } catch (err) {
      console.error('Razorpay initialization error:', err);
      setErrorMessage('An unexpected error occurred while launching Razorpay.');
      setIsSubmitting(false);
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!branch?.id) {
      setErrorMessage('Please select a branch before checking out.');
      return;
    }

    if (!customerName.trim() || !customerPhone.trim()) {
      setErrorMessage('Please provide your name and contact phone number.');
      return;
    }

    let finalAddress = customAddress;
    if (selectedAddressIndex >= 0 && savedAddresses[selectedAddressIndex]) {
      const addr = savedAddresses[selectedAddressIndex];
      finalAddress = `${addr.street}, ${addr.city} ${addr.pincode || ''}`.trim();
    }

    if (orderType === 'DELIVERY' && !finalAddress.trim()) {
      setErrorMessage('Please enter a delivery address.');
      return;
    }

    setIsSubmitting(true);

    // ==========================================
    // 1. CASH ON DELIVERY FLOW
    // ==========================================
    if (paymentMethod === 'CASH') {
      setSubmittingLabel('Placing Your Order...');
      try {
        const result = await createCustomerOrderAction({
          branchId: branch.id,
          orderType,
          tableNumber: orderType === 'DINE_IN' ? tableNumber : undefined,
          customerName,
          customerPhone,
          deliveryAddress: orderType === 'DELIVERY' ? finalAddress : undefined,
          deliveryNotes: deliveryNotes || undefined,
          items: items.map((i) => ({ menuItemId: i.id, quantity: i.quantity })),
          couponCode: appliedCoupon?.code,
          paymentMethod: 'CASH',
        });

        if (result.success && result.orderNumber) {
          clearCart();
          toast.success('Order placed successfully!');
          const targetUrl =
            result.trackingUrl ||
            (result.trackingToken
              ? `/track/${result.orderNumber}?token=${result.trackingToken}`
              : `/track/${result.orderNumber}`);
          router.push(targetUrl);
        } else {
          setErrorMessage(result.error || 'Failed to place order. Please try again.');
          setIsSubmitting(false);
        }
      } catch (err) {
        console.error(err);
        setErrorMessage('An unexpected error occurred. Please try again.');
        setIsSubmitting(false);
      }
      return;
    }

    // ==========================================
    // 2. RAZORPAY & UPI GATEWAY FLOW
    // ==========================================
    setSubmittingLabel('Initializing Payment Gateway...');
    try {
      const initResult = await initiateRazorpayOrderAction({
        branchId: branch.id,
        orderType,
        tableNumber: orderType === 'DINE_IN' ? tableNumber : undefined,
        customerName,
        customerPhone,
        deliveryAddress: orderType === 'DELIVERY' ? finalAddress : undefined,
        deliveryNotes: deliveryNotes || undefined,
        items: items.map((i) => ({ menuItemId: i.id, quantity: i.quantity })),
        couponCode: appliedCoupon?.code,
        paymentMethod: paymentMethod === 'ONLINE' ? 'ONLINE' : 'UPI',
      });

      if (!initResult.success || !initResult.razorpayOrderId || !initResult.orderId) {
        setErrorMessage(initResult.error || 'Unable to connect to payment gateway.');
        setIsSubmitting(false);
        return;
      }

      // Check if running in mock sandbox environment
      if (initResult.isMock) {
        setIsSubmitting(false);
        setMockOrderDetails({
          orderId: initResult.orderId,
          orderNumber: initResult.orderNumber || '',
          amount: (initResult.amount || 0) / 100,
          razorpayOrderId: initResult.razorpayOrderId,
          trackingToken: initResult.trackingToken,
        });
        setMockModalOpen(true);
        return;
      }

      // Launch official Razorpay checkout popup
      await openRazorpayCheckout(initResult);
    } catch (err) {
      console.error('Payment initialization error:', err);
      setErrorMessage('An unexpected error occurred while launching payment.');
      setIsSubmitting(false);
    }
  };

  // Mock modal simulation actions
  const handleSimulateMockSuccess = async () => {
    if (!mockOrderDetails) return;
    setMockModalOpen(false);
    setIsSubmitting(true);
    setSubmittingLabel('Verifying Test Payment...');

    try {
      const mockPaymentId = `pay_mock_${Date.now()}`;
      const verifyResult = await verifyAndCompleteRazorpayPaymentAction({
        orderId: mockOrderDetails.orderId,
        orderNumber: mockOrderDetails.orderNumber,
        razorpayOrderId: mockOrderDetails.razorpayOrderId,
        razorpayPaymentId: mockPaymentId,
        razorpaySignature: 'mock_signature_success',
        trackingToken: mockOrderDetails.trackingToken,
      });

      if (verifyResult.success && verifyResult.trackingUrl) {
        clearCart();
        toast.success('Test payment simulated & order confirmed!');
        router.push(verifyResult.trackingUrl);
      } else {
        setErrorMessage(verifyResult.error || 'Mock verification failed.');
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Failed to simulate test payment.');
      setIsSubmitting(false);
    }
  };

  const handleSimulateMockFailure = () => {
    setMockModalOpen(false);
    setIsSubmitting(false);
    toast.error('Test payment failed. You can re-attempt payment.');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-center justify-between border-b border-border/50 pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            Checkout & Confirmation
          </h1>
          <p className="text-xs text-muted-foreground">
            Review delivery details and select your preferred payment mode
          </p>
        </div>

        <Link
          href="/cart"
          className="text-xs font-semibold text-primary hover:underline"
        >
          &larr; Back to Cart
        </Link>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Delivery & Payment Details */}
        <div className="lg:col-span-7 space-y-6">
          {/* Contact Details */}
          <div className="bg-card rounded-2xl border border-border/70 p-4 sm:p-5 space-y-4">
            <h2 className="font-bold text-sm text-foreground flex items-center gap-2">
              <User className="size-4 text-primary" />
              <span>Contact Information</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Full Name</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-muted/40 border border-border/80 rounded-xl focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="w-full px-3 py-2.5 bg-muted/40 border border-border/80 rounded-xl focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>

          {/* Delivery Address (only for DELIVERY mode) */}
          {orderType === 'DELIVERY' && (
            <div className="bg-card rounded-2xl border border-border/70 p-4 sm:p-5 space-y-4">
              <h2 className="font-bold text-sm text-foreground flex items-center gap-2">
                <MapPin className="size-4 text-primary" />
                <span>Delivery Address</span>
              </h2>

              {/* Saved Address Cards */}
              {savedAddresses.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Saved Addresses
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {savedAddresses.map((addr, idx) => (
                      <div
                        key={addr.id || idx}
                        onClick={() => setSelectedAddressIndex(idx)}
                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                          selectedAddressIndex === idx
                            ? 'bg-primary/5 border-primary shadow-xs'
                            : 'hover:bg-muted/40 border-border/70'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-foreground">
                          {addr.label === 'Work' ? (
                            <Briefcase className="size-3.5 text-primary" />
                          ) : (
                            <Home className="size-3.5 text-primary" />
                          )}
                          <span>{addr.label || `Address ${idx + 1}`}</span>
                        </div>
                        <p className="text-muted-foreground mt-1 line-clamp-2">
                          {addr.street}, {addr.city} {addr.pincode}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Or custom address input */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <label className="text-muted-foreground">
                    {savedAddresses.length > 0 ? 'Or Deliver to a Different Address' : 'Street Address'}
                  </label>
                  {savedAddresses.length > 0 && selectedAddressIndex !== -1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAddressIndex(-1);
                        setCustomAddress('');
                      }}
                      className="text-primary hover:underline text-[11px]"
                    >
                      Enter new address
                    </button>
                  )}
                </div>
                <textarea
                  rows={3}
                  required={orderType === 'DELIVERY' && selectedAddressIndex === -1}
                  placeholder="Flat/House No., Building Name, Street, Landmark, Area..."
                  value={customAddress}
                  onChange={(e) => {
                    setSelectedAddressIndex(-1);
                    setCustomAddress(e.target.value);
                  }}
                  className="w-full px-3 py-2 text-xs bg-muted/40 border border-border/80 rounded-xl focus:outline-none focus:border-primary leading-relaxed"
                />
              </div>

              {/* Delivery / cooking notes */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Cooking / Delivery Instructions (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ring the bell twice, leave at door, less spicy"
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-muted/40 border border-border/80 rounded-xl focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          )}

          {/* Express Pickup Details (for TAKEAWAY mode) */}
          {orderType === 'TAKEAWAY' && (
            <div className="bg-card rounded-2xl border border-primary/30 p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <PackageCheck className="size-4 text-primary" />
                  <span>Express Counter Pickup</span>
                </h2>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                  ZERO QUEUE
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/70 space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-foreground">
                  <MapPin className="size-3.5 text-primary shrink-0" />
                  <span>Pickup Location: {branch?.name || 'Selected Kitchen'}</span>
                </div>
                {branch?.address && (
                  <p className="text-muted-foreground pl-5 text-[11px]">
                    {branch.address}, {branch.city}
                  </p>
                )}
                <p className="text-muted-foreground pl-5 text-[11px] pt-1">
                  When your live order status reaches <strong className="text-foreground">READY</strong>, walk in directly to the Express Pickup counter to collect your fresh box.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Estimated Arrival / Kitchen Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Arriving in 15 mins, packing napkins separately"
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-muted/40 border border-border/80 rounded-xl focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          )}

          {/* Payment Method Selector */}
          <div className="bg-card rounded-2xl border border-border/70 p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm text-foreground flex items-center gap-2">
                <CreditCard className="size-4 text-primary" />
                <span>Choose Payment Method</span>
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">
                Secured by Razorpay
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* UPI */}
              <div
                onClick={() => setPaymentMethod('UPI')}
                className={`p-3.5 rounded-xl border text-xs cursor-pointer flex flex-col justify-between space-y-2 transition-all ${
                  paymentMethod === 'UPI'
                    ? 'bg-primary/5 border-primary shadow-xs ring-1 ring-primary/20'
                    : 'hover:bg-muted/40 border-border/70'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="size-8 rounded-lg bg-orange-500/10 text-orange-600 flex items-center justify-center">
                    <Smartphone className="size-4" />
                  </div>
                  <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 bg-blue-600 text-white rounded">
                    RZP
                  </span>
                </div>
                <div>
                  <span className="font-bold text-foreground block">UPI (Razorpay)</span>
                  <span className="text-[11px] text-muted-foreground">GPay, PhonePe, Paytm, BHIM</span>
                </div>
              </div>

              {/* Online Card */}
              <div
                onClick={() => setPaymentMethod('ONLINE')}
                className={`p-3.5 rounded-xl border text-xs cursor-pointer flex flex-col justify-between space-y-2 transition-all ${
                  paymentMethod === 'ONLINE'
                    ? 'bg-primary/5 border-primary shadow-xs ring-1 ring-primary/20'
                    : 'hover:bg-muted/40 border-border/70'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="size-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                    <CreditCard className="size-4" />
                  </div>
                  <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 bg-blue-600 text-white rounded">
                    RZP
                  </span>
                </div>
                <div>
                  <span className="font-bold text-foreground block">Cards & NetBanking</span>
                  <span className="text-[11px] text-muted-foreground">Visa, MasterCard, 50+ Banks</span>
                </div>
              </div>

              {/* Cash on Delivery / Counter */}
              <div
                onClick={() => setPaymentMethod('CASH')}
                className={`p-3.5 rounded-xl border text-xs cursor-pointer flex flex-col justify-between space-y-2 transition-all ${
                  paymentMethod === 'CASH'
                    ? 'bg-primary/5 border-primary shadow-xs ring-1 ring-primary/20'
                    : 'hover:bg-muted/40 border-border/70'
                }`}
              >
                <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <Banknote className="size-4" />
                </div>
                <div>
                  <span className="font-bold text-foreground block">Cash on Delivery</span>
                  <span className="text-[11px] text-muted-foreground">Pay in cash when delivered</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary & Place Order CTA */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-card rounded-2xl border border-border/70 p-5 space-y-4 shadow-sm">
            <h3 className="font-black text-sm uppercase tracking-wider text-muted-foreground">
              Order Review ({itemCount} {itemCount === 1 ? 'item' : 'items'})
            </h3>

            {/* Quick list of items */}
            <div className="divide-y divide-border/40 max-h-56 overflow-y-auto pr-1">
              {items.map((i) => (
                <div key={i.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-primary">{i.quantity}x</span>
                    <span className="font-semibold text-foreground">{i.name}</span>
                  </div>
                  <span className="font-bold">₹{(i.price * i.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Financials */}
            <div className="pt-3 border-t border-border/60 space-y-2 text-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="font-semibold text-foreground">₹{subtotal.toFixed(2)}</span>
              </div>

              {orderType === 'DELIVERY' && (
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Delivery Charge</span>
                  <span className="font-semibold text-foreground">
                    {deliveryFee === 0 ? <span className="text-emerald-600 font-bold">FREE</span> : `₹${deliveryFee.toFixed(2)}`}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-muted-foreground">
                <span>GST (5%)</span>
                <span className="font-semibold text-foreground">₹{tax.toFixed(2)}</span>
              </div>

              {discount > 0 && (
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span>Discount ({appliedCoupon?.code})</span>
                  <span>-₹{discount.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Grand Total */}
            <div className="pt-3 border-t border-border/60 flex items-center justify-between">
              <div>
                <span className="font-black text-base text-foreground block">Total Amount</span>
                <span className="text-[10px] text-muted-foreground">All taxes included</span>
              </div>
              <span className="text-2xl font-black text-foreground">
                ₹{total.toFixed(2)}
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-xl bg-linear-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-extrabold text-sm shadow-xl shadow-orange-600/25 flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>{submittingLabel}</span>
                </>
              ) : (
                <>
                  <span>
                    {paymentMethod === 'CASH'
                      ? `Place Order • ₹${total.toFixed(2)}`
                      : paymentMethod === 'UPI'
                      ? `Pay with UPI • ₹${total.toFixed(2)}`
                      : `Pay with Card / NetBanking • ₹${total.toFixed(2)}`}
                  </span>
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>

            <p className="text-center text-[10px] text-muted-foreground flex items-center justify-center gap-1">
              <ShieldCheck className="size-3 text-emerald-500" />
              <span>Safe & Secure 256-bit Razorpay encrypted checkout</span>
            </p>
          </div>
        </div>
      </form>


      {/* Razorpay Mock Sandbox Modal (active when real keys are not in .env) */}
      {mockOrderDetails && (
        <RazorpayMockModal
          open={mockModalOpen}
          onOpenChange={setMockModalOpen}
          orderNumber={mockOrderDetails.orderNumber}
          amount={mockOrderDetails.amount}
          onSimulateSuccess={handleSimulateMockSuccess}
          onSimulateFailure={handleSimulateMockFailure}
        />
      )}
    </div>
  );
}
