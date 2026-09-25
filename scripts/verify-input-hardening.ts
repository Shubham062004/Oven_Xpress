/**
 * Verification Script: Input Validation & Sanitization Hardening Test Suite
 *
 * Validates:
 * 1. XSS / Script Injection Neutralization (sanitizeText)
 * 2. CSV Formula / Command Injection Neutralization (sanitizeCsvCell / escapeCSV)
 * 3. Path Traversal & Filename Sanitization (sanitizeFilename)
 * 4. File Upload Protection & Magic Byte Verification (validateReceiptFile / verifyBufferMagicBytes)
 * 5. Query Parameter & Search Query Hardening (sanitizeSearchQuery)
 * 6. Pagination & Bounded Integer Parsing (parseBoundedInt)
 * 7. Open Redirect & Callback URL Defense (isSafeRedirectUrl / sanitizeRedirectUrl)
 * 8. Deep Payload Sanitization (sanitizePayload)
 * 9. Integration with Domain Schemas (customerSchema, createOrderSchema, createExpenseSchema, loginSchema)
 *
 * Usage: npx tsx scripts/verify-input-hardening.ts
 */

import {
  sanitizeText,
  sanitizeCsvCell,
  sanitizeFilename,
  sanitizeSearchQuery,
  parseBoundedInt,
  sanitizePayload,
} from '../src/lib/security/input-sanitizer';
import {
  isSafeRedirectUrl,
  sanitizeRedirectUrl,
} from '../src/lib/security/url-validation';
import {
  validateReceiptFile,
  verifyBufferMagicBytes,
} from '../src/lib/storage/receipts';
import { customerSchema, customerFilterSchema } from '../src/lib/validations/customers';
import { createOrderSchema, cancelOrderSchema, orderFilterSchema } from '../src/lib/validations/orders';
import { createExpenseSchema, expenseFilterSchema } from '../src/lib/validations/expenses';
import { loginSchema } from '../src/lib/validations/auth';
import { escapeCSV } from '../src/lib/reports/constants';

let totalChecks = 0;
let passedChecks = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    console.error(`  ✗ [FAIL] ${testName}${detail ? ` - Detail: ${detail}` : ''}`);
  }
}

async function runTests() {
  console.log('===============================================================');
  console.log('   Oven_Xpress Security Hardening: Input Validation & Sanitization');
  console.log('===============================================================\n');

  // ─── 1. XSS & Script Injection Neutralization ──────────────────────────────
  console.log('1. Testing XSS & Script Injection Neutralization (sanitizeText)...');
  
  const xssTag = sanitizeText('<script>alert("XSS")</script>');
  assert(!xssTag.includes('<script>') && !xssTag.includes('</script>'), 'Strips executable <script> tags', xssTag);

  const xssIframe = sanitizeText('<iframe src="javascript:alert(1)"></iframe>');
  assert(!xssIframe.includes('<iframe') && !xssIframe.includes('</iframe>'), 'Strips <iframe> tags', xssIframe);

  const xssSvg = sanitizeText('<svg onload=alert(1)>');
  assert(!xssSvg.includes('<svg'), 'Strips <svg> tags', xssSvg);

  const xssImgOnError = sanitizeText('<img src=x onerror=alert(1)>');
  assert(!xssImgOnError.includes('onerror'), 'Strips inline onerror event handler', xssImgOnError);

  const xssJsProto = sanitizeText('javascript:fetch("https://attacker.com")');
  assert(!xssJsProto.toLowerCase().includes('javascript:'), 'Disarms javascript: pseudoprotocol', xssJsProto);

  const controlChars = sanitizeText('Hello\x00\x08World\x1B');
  assert(!controlChars.includes('\x00') && !controlChars.includes('\x08') && !controlChars.includes('\x1B'), 'Strips non-printable control characters');

  const encodedHtml = sanitizeText('Bold <b>Text</b>');
  assert(encodedHtml.includes('&lt;') && encodedHtml.includes('&gt;'), 'HTML-encodes angle brackets to neutralize DOM parsing', encodedHtml);

  const safeText = sanitizeText('John Doe, Flat 4B, Baker Street');
  assert(safeText === 'John Doe, Flat 4B, Baker Street', 'Preserves legitimate text');

  // ─── 2. CSV Formula / Command Injection Neutralization (CWE-1236) ─────────
  console.log('\n2. Testing CSV Formula & Command Injection Neutralization (sanitizeCsvCell / escapeCSV)...');

  const formulaCmd = sanitizeCsvCell("=cmd|'/c calc'!A0");
  assert(formulaCmd.startsWith("'="), 'Prepends single quote to neutralize = formula trigger', formulaCmd);

  const formulaPlus = sanitizeCsvCell('+1+2');
  assert(formulaPlus.startsWith("'+"), 'Prepends single quote to neutralize + trigger', formulaPlus);

  const formulaMinus = sanitizeCsvCell('-SUM(1,2)');
  assert(formulaMinus.startsWith("'-") || formulaMinus.startsWith("\"'-"), 'Prepends single quote to neutralize - trigger', formulaMinus);

  const formulaAt = sanitizeCsvCell('@SUM(A1:A10)');
  assert(formulaAt.startsWith("'@"), 'Prepends single quote to neutralize @ trigger', formulaAt);

  const formulaPipe = sanitizeCsvCell('|cmd');
  assert(formulaPipe.startsWith("'|"), 'Prepends single quote to neutralize | trigger', formulaPipe);

  const formulaTab = sanitizeCsvCell('\t=calc');
  assert(formulaTab.startsWith("'\t"), 'Prepends single quote to neutralize tab trigger', formulaTab);

  const csvEscaped = escapeCSV("=cmd|'/c calc'!A0");
  assert(csvEscaped.startsWith("'=") || csvEscaped.startsWith("\"'="), 'escapeCSV in reports pipeline neutralizes formula injection', csvEscaped);

  const normalCsv = sanitizeCsvCell('Normal Text');
  assert(normalCsv === 'Normal Text', 'Leaves standard alphanumeric text untouched', normalCsv);

  const quotedCsv = sanitizeCsvCell('Acme, Inc.');
  assert(quotedCsv === '"Acme, Inc."', 'Properly wraps comma-containing strings in quotes', quotedCsv);

  // ─── 3. Path Traversal & Filename Sanitization ─────────────────────────────
  console.log('\n3. Testing Path Traversal & Filename Sanitization (sanitizeFilename)...');

  const traversalUnix = sanitizeFilename('../../etc/passwd');
  assert(!traversalUnix.includes('/') && !traversalUnix.includes('..'), 'Strips Unix path traversal (../../etc/passwd)', traversalUnix);

  const traversalWin = sanitizeFilename('..\\..\\windows\\system32\\cmd.exe');
  assert(!traversalWin.includes('\\') && !traversalWin.includes('..'), 'Strips Windows path traversal (..\\..\\cmd.exe)', traversalWin);

  const nullByte = sanitizeFilename('invoice\0.pdf');
  assert(!nullByte.includes('\0'), 'Strips null bytes from filename', nullByte);

  const specialChars = sanitizeFilename('my receipt $#@!*&.pdf');
  assert(/^[a-zA-Z0-9._\- ]+$/.test(specialChars), 'Limits filename to alphanumeric, dots, hyphens, and spaces', specialChars);

  const longFilename = sanitizeFilename('a'.repeat(150) + '.png');
  assert(longFilename.length <= 100 && longFilename.endsWith('.png'), 'Truncates overly long filenames while preserving extension', `length: ${longFilename.length}`);

  const emptyFilename = sanitizeFilename('');
  assert(emptyFilename === 'unnamed_file', 'Returns safe fallback for empty filename', emptyFilename);

  // ─── 4. File Upload Protection & Magic Byte Verification ──────────────────
  console.log('\n4. Testing File Upload Validation & Binary Magic Bytes...');

  const validPdfBuffer = Buffer.from('%PDF-1.7\n%test stream');
  assert(verifyBufferMagicBytes(validPdfBuffer, 'application/pdf'), 'Verifies genuine PDF magic bytes (%PDF-)');

  const disguisedPdfBuffer = Buffer.from('<html><script>alert("evil")</script></html>');
  assert(!verifyBufferMagicBytes(disguisedPdfBuffer, 'application/pdf'), 'Rejects disguised HTML buffer presented as PDF');

  const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  assert(verifyBufferMagicBytes(validPngBuffer, 'image/png'), 'Verifies genuine PNG magic bytes');

  const fakePngBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00'); // Windows PE executable header
  assert(!verifyBufferMagicBytes(fakePngBuffer, 'image/png'), 'Rejects disguised executable buffer presented as PNG');

  const validJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  assert(verifyBufferMagicBytes(validJpegBuffer, 'image/jpeg'), 'Verifies genuine JPEG magic bytes');

  const validWebpBuffer = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]);
  assert(verifyBufferMagicBytes(validWebpBuffer, 'image/webp'), 'Verifies genuine WEBP magic bytes');

  const invalidMime = validateReceiptFile('text/html', 1024, 'evil.html');
  assert(!invalidMime.valid, 'Rejects unauthorized MIME type (text/html)');

  const oversizedFile = validateReceiptFile('application/pdf', 6 * 1024 * 1024, 'big.pdf');
  assert(!oversizedFile.valid, 'Rejects files exceeding 5MB limit');

  // ─── 5. Query Parameter & Search Query Hardening ──────────────────────────
  console.log('\n5. Testing Query Parameter & Search Query Hardening (sanitizeSearchQuery)...');

  const longQuery = 'A'.repeat(200);
  const sanitizedQuery = sanitizeSearchQuery(longQuery, 100);
  assert(sanitizedQuery.length === 100, 'Limits search queries to maximum length (100 chars)');

  const queryWithControls = sanitizeSearchQuery('search\x00term\x1Fhere');
  assert(!queryWithControls.includes('\x00') && !queryWithControls.includes('\x1F'), 'Strips non-printable control characters from queries');

  const trimmedQuery = sanitizeSearchQuery('   pepperoni pizza   ');
  assert(trimmedQuery === 'pepperoni pizza', 'Trims whitespace from search queries');

  // ─── 6. Bounded Integer & Pagination Parsing ──────────────────────────────
  console.log('\n6. Testing Bounded Integer & Pagination Parsing (parseBoundedInt)...');

  assert(parseBoundedInt(-10, 1, 1, 100) === 1, 'Clamps negative numbers to minimum (1)');
  assert(parseBoundedInt(5000, 20, 1, 100) === 100, 'Clamps exorbitant numbers to maximum (100)');
  assert(parseBoundedInt('42', 1, 1, 100) === 42, 'Parses valid integer string ("42" -> 42)');
  assert(parseBoundedInt('invalid_num', 20, 1, 100) === 20, 'Returns fallback for NaN input');
  assert(parseBoundedInt(null, 15, 1, 100) === 15, 'Returns fallback for null input');

  // ─── 7. Open Redirect & Callback URL Defense ──────────────────────────────
  console.log('\n7. Testing Open Redirect & Callback URL Defense...');

  assert(isSafeRedirectUrl('/orders'), 'Allows safe relative path (/orders)');
  assert(isSafeRedirectUrl('/dashboard/reports?branch=b1'), 'Allows safe path with query parameters');
  assert(!isSafeRedirectUrl('https://evil.com'), 'Rejects absolute external URL (https://evil.com)');
  assert(!isSafeRedirectUrl('//evil.com'), 'Rejects protocol-relative URL (//evil.com)');
  assert(!isSafeRedirectUrl('/\\evil.com'), 'Rejects backslash bypass (/\\evil.com)');
  assert(!isSafeRedirectUrl('javascript:alert(1)'), 'Rejects javascript: URI scheme');
  assert(sanitizeRedirectUrl('https://evil.com', '/') === '/', 'sanitizeRedirectUrl falls back to safe path (/)');

  // ─── 8. Deep Payload Sanitization ─────────────────────────────────────────
  console.log('\n8. Testing Deep Payload Sanitization (sanitizePayload)...');

  const rawPayload = {
    name: '<script>alert(1)</script>John',
    details: {
      bio: '<img src=x onerror=alert(2)>Chef',
      tags: ['<svg onload=1>', 'wood-fired'],
    },
    password: 'P@ssword123!Safe<DontTouch>',
  };

  const cleanPayload = sanitizePayload(rawPayload);
  assert(!cleanPayload.name.includes('<script>'), 'Sanitizes top-level string property');
  assert(!cleanPayload.details.bio.includes('onerror'), 'Sanitizes deeply nested string property');
  assert(!cleanPayload.details.tags[0].includes('<svg'), 'Sanitizes array element string');
  assert(cleanPayload.password === 'P@ssword123!Safe<DontTouch>', 'Preserves password fields without mangling');

  // ─── 9. Domain Schema Validation & Sanitization Integration ───────────────
  console.log('\n9. Testing Domain Schema Validation & Sanitization Integration...');

  // Customer Schema
  const parsedCustomer = customerSchema.parse({
    name: '<script>alert(1)</script>Jane Doe',
    notes: '<img src=x onerror=steal()>VIP guest',
    phone: '+919876543210',
  });
  assert(!parsedCustomer.name.includes('<script>'), 'customerSchema sanitizes customer name');
  assert(!parsedCustomer.notes?.includes('onerror'), 'customerSchema sanitizes customer notes');

  // Customer Filter Schema
  const parsedCustomerFilter = customerFilterSchema.parse({
    search: '  <script>evil</script>Jane  ',
  });
  assert(!parsedCustomerFilter.search?.includes('<script>'), 'customerFilterSchema sanitizes search query');

  // Order Schema
  const parsedOrder = createOrderSchema.parse({
    branchId: 'branch-123',
    orderType: 'DELIVERY',
    customerName: '<b>Alice</b>',
    customerPhone: '+919876543211',
    deliveryAddress: '<script>dropDatabase()</script>123 High Street',
    deliveryNotes: '<iframe src=bad></iframe>Ring bell twice',
    notes: '<object>evil</object>Extra cheese',
    items: [{ menuItemId: 'item-1', quantity: 2, notes: '<svg>none</svg>' }],
  });
  assert(Boolean(!parsedOrder.customerName?.includes('<b>') && parsedOrder.customerName?.includes('&lt;b&gt;')), 'createOrderSchema encodes HTML in customerName');
  assert(!parsedOrder.deliveryAddress?.includes('<script>'), 'createOrderSchema sanitizes deliveryAddress');
  assert(!parsedOrder.deliveryNotes?.includes('<iframe'), 'createOrderSchema sanitizes deliveryNotes');
  assert(!parsedOrder.notes?.includes('<object'), 'createOrderSchema sanitizes order notes');
  assert(!parsedOrder.items[0].notes?.includes('<svg'), 'createOrderSchema sanitizes order item notes');

  // Cancel Order Schema
  const parsedCancel = cancelOrderSchema.parse({
    orderId: 'order-1',
    reason: '<script>alert("cancel")</script>Customer changed mind',
  });
  assert(!parsedCancel.reason.includes('<script>'), 'cancelOrderSchema sanitizes cancellation reason');

  // Expense Schema
  const parsedExpense = createExpenseSchema.parse({
    branchId: 'branch-1',
    categoryId: 'cat-1',
    amount: 1500,
    expenseDate: '2026-03-25',
    description: '<script>bad()</script>Fresh Flour Delivery',
    vendorName: '<b>Flour Mill Ltd</b>',
    paymentMethod: 'UPI',
    referenceNumber: '<svg>REF-12345</svg>',
    notes: '<iframe src=x></iframe>Weekly stock replenishment',
  });
  assert(!parsedExpense.description.includes('<script>'), 'createExpenseSchema sanitizes description');
  assert(!parsedExpense.notes?.includes('<iframe'), 'createExpenseSchema sanitizes notes');
  assert(!parsedExpense.referenceNumber?.includes('<svg'), 'createExpenseSchema sanitizes referenceNumber');

  // Login Schema
  const parsedLogin = loginSchema.parse({
    email: 'admin@ovenxpress.com',
    password: 'ValidPassword123!',
    callbackUrl: 'https://attacker.com/steal-token',
  });
  assert(parsedLogin.callbackUrl === '/', 'loginSchema neutralizes open redirect in callbackUrl to safe /');

  console.log('\n===============================================================');
  console.log(`Results: ${passedChecks}/${totalChecks} checks passed.`);
  console.log('===============================================================\n');

  if (passedChecks !== totalChecks) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
