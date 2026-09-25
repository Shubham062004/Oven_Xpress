import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, getAuthorizedBranchScope } from '@/lib/auth/guards';
import { hasAnyPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { prisma } from '@/lib/db/prisma';
import { getReceiptBuffer, deleteReceiptBuffer } from '@/lib/storage/receipts';
import { sanitizeFilename } from '@/lib/security/input-sanitizer';
import { logApiError, logTrafficAnomaly } from '@/lib/security/security-logger';

interface RouteContext {
  params: Promise<{ filename: string }>;
}

/**
 * GET /api/uploads/receipt/[filename]
 *
 * Secure, authenticated, and branch-authorized file streaming from Azure Blob Storage.
 *
 * Security Requirements Enforced:
 * 1. Authentication: Rejects unauthenticated requests with 401.
 * 2. Authorization (RBAC): Requires EXPENSE_READ or PURCHASE_READ.
 * 3. Multi-Branch Isolation: If user has branch-restricted access, verifies that the
 *    receipt is associated with an expense in their authorized branch.
 * 4. Content Security: Sets strict sandboxing headers, no-sniff, and inline disposition.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const clientIp =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  const { filename: rawFilename } = await context.params;
  const cleanFilename = sanitizeFilename(rawFilename);
  const path = `/api/uploads/receipt/${cleanFilename}`;

  try {
    // 1. Authenticate user
    const user = await getCurrentUser();
    if (!user) {
      logTrafficAnomaly({
        type: 'UNAUTHORIZED_API_ACCESS',
        path,
        method: 'GET',
        clientIp,
        userAgent,
        statusCode: 401,
        reason: 'Unauthenticated attempt to view private storage blob',
      });
      return NextResponse.json(
        { error: 'Unauthorized. Authentication session required.' },
        { status: 401 }
      );
    }

    // 2. Authorize user (must have read permission for expenses or purchases)
    const canRead = hasAnyPermission(user, [
      PERMISSIONS.EXPENSE_READ,
      PERMISSIONS.PURCHASE_READ,
    ]);

    if (!canRead) {
      logTrafficAnomaly({
        type: 'FORBIDDEN_RESOURCE_ACCESS',
        path,
        method: 'GET',
        clientIp,
        userAgent,
        statusCode: 403,
        reason: `User ${user.id} (${user.role}) lacks permission to read private receipts`,
      });
      return NextResponse.json(
        { error: 'Forbidden. Insufficient permissions to view receipts.' },
        { status: 403 }
      );
    }

    // 3. Multi-branch authorization: verify tenant boundary
    const scope = await getAuthorizedBranchScope(user);
    if (!scope.isAllBranches) {
      // Find the expense associated with this receipt file
      const expense = await prisma.expense.findFirst({
        where: {
          receiptUrl: {
            contains: cleanFilename,
          },
        },
        select: {
          id: true,
          branchId: true,
        },
      });

      if (expense && !scope.branchIds.includes(expense.branchId)) {
        logTrafficAnomaly({
          type: 'FORBIDDEN_RESOURCE_ACCESS',
          path,
          method: 'GET',
          clientIp,
          userAgent,
          statusCode: 403,
          reason: `Cross-branch tenant violation: User ${user.id} attempted to view receipt from branch ${expense.branchId}`,
        });
        return NextResponse.json(
          { error: 'Forbidden. Access to this receipt is restricted to its assigned branch.' },
          { status: 403 }
        );
      }
    }

    // 4. Retrieve blob from Azure Blob Storage (or legacy disk fallback)
    const receipt = await getReceiptBuffer(cleanFilename);

    return new NextResponse(receipt.buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': receipt.mimeType,
        'Content-Length': String(receipt.contentLength),
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'Content-Disposition': `inline; filename="${cleanFilename}"`,
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    const statusCode = (error as unknown as { statusCode?: number })?.statusCode || 500;
    if (statusCode === 404) {
      return NextResponse.json({ error: 'Receipt file not found.' }, { status: 404 });
    }

    logApiError({
      path,
      method: 'GET',
      statusCode: 500,
      error,
      clientIp,
      userAgent,
    });

    return NextResponse.json(
      { error: 'Failed to retrieve receipt from storage.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/uploads/receipt/[filename]
 *
 * Secure, authenticated, and branch-authorized deletion of blobs from Azure Blob Storage.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const clientIp =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  const { filename: rawFilename } = await context.params;
  const cleanFilename = sanitizeFilename(rawFilename);
  const path = `/api/uploads/receipt/${cleanFilename}`;

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized. Authentication session required.' },
        { status: 401 }
      );
    }

    const canDelete = hasAnyPermission(user, [
      PERMISSIONS.EXPENSE_UPDATE,
      PERMISSIONS.EXPENSE_CANCEL,
      PERMISSIONS.PURCHASE_UPDATE,
    ]);

    if (!canDelete) {
      return NextResponse.json(
        { error: 'Forbidden. Insufficient permissions to delete receipts.' },
        { status: 403 }
      );
    }

    // Branch ownership check
    const scope = await getAuthorizedBranchScope(user);
    if (!scope.isAllBranches) {
      const expense = await prisma.expense.findFirst({
        where: { receiptUrl: { contains: cleanFilename } },
        select: { id: true, branchId: true },
      });

      if (expense && !scope.branchIds.includes(expense.branchId)) {
        return NextResponse.json(
          { error: 'Forbidden. You do not have permission to delete receipts from this branch.' },
          { status: 403 }
        );
      }
    }

    await deleteReceiptBuffer(cleanFilename);

    return NextResponse.json({
      success: true,
      message: 'Receipt deleted successfully from storage.',
    });
  } catch (error) {
    logApiError({
      path,
      method: 'DELETE',
      statusCode: 500,
      error,
      clientIp,
      userAgent,
    });

    return NextResponse.json(
      { error: 'Failed to delete receipt from storage.' },
      { status: 500 }
    );
  }
}
