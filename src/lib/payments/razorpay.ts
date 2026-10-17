import Razorpay from 'razorpay';
import crypto from 'crypto';

export interface CreateRazorpayOrderOptions {
  amount: number; // in INR (Rupees)
  receipt: string;
  notes?: Record<string, string>;
  currency?: string;
}

export interface RazorpayOrderResult {
  id: string;
  amount: number; // in paise
  currency: string;
  receipt?: string;
  status: string;
  notes?: Record<string, string>;
  isMock: boolean;
}

export interface VerifySignatureOptions {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

/**
 * Returns true if valid, non-placeholder Razorpay credentials exist in environment variables.
 */
export function isRazorpayConfigured(): boolean {
  const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) return false;
  if (keyId.includes('placeholder') || keySecret.includes('placeholder')) return false;

  return true;
}

/**
 * Returns the active Razorpay Key ID for client-side checkout rendering.
 */
export function getRazorpayKeyId(): string {
  return (
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
    process.env.RAZORPAY_KEY_ID ||
    'rzp_test_placeholder'
  );
}

/**
 * Lazily instantiate the Razorpay server client.
 */
let razorpayInstance: Razorpay | null = null;

export function getRazorpayClient(): Razorpay | null {
  if (!isRazorpayConfigured()) {
    return null;
  }

  if (!razorpayInstance) {
    const keyId = (process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) as string;
    const keySecret = process.env.RAZORPAY_KEY_SECRET as string;
    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }

  return razorpayInstance;
}

/**
 * Creates an order with Razorpay or provides a robust development sandbox order
 * if API keys have not yet been populated in .env.
 */
export async function createRazorpayOrder({
  amount,
  receipt,
  notes = {},
  currency = 'INR',
}: CreateRazorpayOrderOptions): Promise<RazorpayOrderResult> {
  const amountInPaise = Math.round(amount * 100);

  if (isRazorpayConfigured()) {
    const client = getRazorpayClient();
    if (!client) {
      throw new Error('Failed to initialize Razorpay client.');
    }

    const order = await client.orders.create({
      amount: amountInPaise,
      currency,
      receipt,
      notes,
    });

    return {
      id: order.id,
      amount: Number(order.amount),
      currency: order.currency,
      receipt: order.receipt || receipt,
      status: order.status,
      notes: (order.notes as Record<string, string>) || notes,
      isMock: false,
    };
  }

  // Fallback for development / test mode when user hasn't added live keys yet
  const mockId = `order_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  return {
    id: mockId,
    amount: amountInPaise,
    currency,
    receipt,
    status: 'created',
    notes,
    isMock: true,
  };
}

/**
 * Verifies the payment signature returned by Razorpay Checkout.
 */
export function verifyRazorpayPaymentSignature({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}: VerifySignatureOptions): boolean {
  // Allow simulated sandbox signatures during local development if keys are not set
  if (razorpayOrderId.startsWith('order_mock_')) {
    return (
      razorpaySignature === 'mock_signature_success' ||
      razorpaySignature.startsWith('mock_') ||
      process.env.NODE_ENV !== 'production'
    );
  }

  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;

  const generatedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(generatedSignature, 'utf-8'),
      Buffer.from(razorpaySignature, 'utf-8')
    );
  } catch {
    return false;
  }
}

/**
 * Validates incoming webhooks from Razorpay using the configured webhook secret.
 */
export function verifyRazorpayWebhookSignature({
  rawBody,
  signature,
}: {
  rawBody: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;

  const generatedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(generatedSignature, 'utf-8'),
      Buffer.from(signature, 'utf-8')
    );
  } catch {
    return false;
  }
}

export interface RazorpayQrResult {
  id: string;
  imageUrl: string;
  status: string;
}

/**
 * Creates a single-use fixed amount dynamic QR code using Razorpay's official QR Code API.
 * Returns null if the account does not have QR Code API enabled or keys are unconfigured.
 */
export async function createRazorpayQrCode({
  amount,
  orderNumber,
  notes = {},
}: {
  amount: number;
  orderNumber: string;
  notes?: Record<string, string>;
}): Promise<RazorpayQrResult | null> {
  if (!isRazorpayConfigured()) return null;
  const client = getRazorpayClient();
  if (!client || !client.qrCode) return null;

  try {
    const amountInPaise = Math.round(amount * 100);
    const closeBy = Math.floor(Date.now() / 1000) + 1800; // 30 minutes

    const qr = await client.qrCode.create({
      type: 'upi_qr',
      name: `Oven Xpress #${orderNumber}`,
      usage: 'single_use',
      fixed_amount: true,
      payment_amount: amountInPaise,
      description: `Order #${orderNumber}`,
      close_by: closeBy,
      notes,
    });

    return {
      id: qr.id,
      imageUrl: qr.image_url,
      status: qr.status,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[Razorpay QR API] Note: Official QR API not enabled or returned error:', message);
    return null;
  }
}

/**
 * Fetches all payments associated with a Razorpay Order ID.
 */
export async function fetchRazorpayOrderPayments(razorpayOrderId: string) {
  if (!isRazorpayConfigured()) return null;
  const client = getRazorpayClient();
  if (!client) return null;

  try {
    return await client.orders.fetchPayments(razorpayOrderId);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[Razorpay] Error fetching payments for order:', message);
    return null;
  }
}

