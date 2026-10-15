import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/realtime/stream/route';
import { prisma } from '../src/lib/db/prisma';
import { generateTrackingToken } from '../src/lib/customer/tracking-token';

async function testSSERoute() {
  console.log('=== TESTING REAL-TIME SSE ROUTE AUTHORIZATION ===\n');

  const branch = await prisma.branch.findFirst({
    where: { status: 'ACTIVE' },
    select: { id: true },
  });

  if (!branch) {
    throw new Error('No active branch found');
  }

  // Create temporary test order with tracking token hash
  const { token: validToken, tokenHash } = generateTrackingToken();
  const testOrderNum = `OX-TEST-SSE-${Date.now()}`;

  const createdOrder = await prisma.order.create({
    data: {
      orderNumber: testOrderNum,
      branchId: branch.id,
      orderType: 'TAKEAWAY',
      status: 'CONFIRMED',
      customerName: 'SSE Tester',
      customerPhone: '+919876500000',
      subtotal: 100,
      totalAmount: 100,
      createdBy: 'CUSTOMER_SELF_SERVICE',
      trackingTokenHash: tokenHash,
    },
  });

  try {
    // 1. Guest request WITHOUT token -> must return 401 Unauthorized
    const reqNoToken = new NextRequest(`http://localhost:3000/api/realtime/stream?orderNumber=${testOrderNum}`);
    const resNoToken = await GET(reqNoToken);
    console.log(`[PASS] Guest without token -> HTTP ${resNoToken.status} (Expected 401)`);
    if (resNoToken.status !== 401) {
      throw new Error(`Expected 401, got ${resNoToken.status}`);
    }

    // 2. Guest request with INVALID token -> must return 401 Unauthorized
    const reqInvalidToken = new NextRequest(`http://localhost:3000/api/realtime/stream?orderNumber=${testOrderNum}&token=wrongtoken`);
    const resInvalidToken = await GET(reqInvalidToken);
    console.log(`[PASS] Guest with invalid token -> HTTP ${resInvalidToken.status} (Expected 401)`);
    if (resInvalidToken.status !== 401) {
      throw new Error(`Expected 401, got ${resInvalidToken.status}`);
    }

    // 3. Guest request with VALID token -> must return 200 OK (text/event-stream)
    const reqValidToken = new NextRequest(`http://localhost:3000/api/realtime/stream?orderNumber=${testOrderNum}&token=${validToken}`);
    const resValidToken = await GET(reqValidToken);
    const contentType = resValidToken.headers.get('content-type');
    console.log(`[PASS] Guest with valid token -> HTTP ${resValidToken.status}, Content-Type: ${contentType} (Expected 200, text/event-stream)`);
    if (resValidToken.status !== 200 || !contentType?.includes('text/event-stream')) {
      throw new Error(`Expected 200 text/event-stream, got ${resValidToken.status} ${contentType}`);
    }

    // 4. Request with different orderNumber but same token (Tampering) -> must return 401
    const reqTampered = new NextRequest(`http://localhost:3000/api/realtime/stream?orderNumber=OX-NONEXISTENT&token=${validToken}`);
    const resTampered = await GET(reqTampered);
    console.log(`[PASS] Tampered orderNumber with mismatched token -> HTTP ${resTampered.status} (Expected 401)`);
    if (resTampered.status !== 401) {
      throw new Error(`Expected 401, got ${resTampered.status}`);
    }

    console.log('\nALL SSE AUTHORIZATION TESTS PASSED!\n');
  } finally {
    await prisma.order.delete({ where: { id: createdOrder.id } });
  }
}

testSSERoute().catch((err) => {
  console.error('SSE Route Test failed:', err);
  process.exit(1);
});
