'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { getCurrentUser, getAuthorizedBranchScope, isBranchAuthorized } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { Prisma } from '@prisma/client';
import type {
  CustomerListItem,
  CustomerDetail,
  CustomerOrderRow,
  ReviewItem,
  CustomerIssueItem,
  FeedbackDashboardData,
  BranchFeedbackSummary,
  PaginatedResult,
} from './types';
import {
  customerSchema,
  updateCustomerSchema,
  customerFilterSchema,
  createReviewSchema,
  moderateReviewSchema,
  reviewFilterSchema,
  createCustomerIssueSchema,
  assignIssueSchema,
  resolveIssueSchema,
  updateIssueStatusSchema,
  issueFilterSchema,
  type CustomerInput,
  type UpdateCustomerInput,
  type CreateReviewInput,
  type ModerateReviewInput,
  type CreateCustomerIssueInput,
  type AssignIssueInput,
  type ResolveIssueInput,
  type UpdateIssueStatusInput,
} from '@/lib/validations/customers';

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Scoping & Privacy Helpers ───────────────────────────────────────────────



function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  const clean = phone.trim();
  if (clean.length <= 4) return '****';
  const last4 = clean.slice(-4);
  return `${clean.slice(0, 3)}*** **** ${last4}`;
}

function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const parts = email.split('@');
  if (parts.length !== 2) return '***@***.***';
  const name = parts[0];
  const domain = parts[1];
  const visible = name.length > 2 ? `${name.slice(0, 2)}***` : `${name[0]}***`;
  return `${visible}@${domain}`;
}

/**
 * Concurrency-safe sequential customer issue number generator.
 * Format: ISS-YYYY-000001
 * Uses PostgreSQL advisory transaction lock to guarantee uniqueness.
 */
async function generateIssueNumber(tx: Prisma.TransactionClient): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `ISS-${currentYear}-`;

  const lockKey = `customer_issue_seq_${currentYear}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

  const latestIssue = await tx.customerIssue.findFirst({
    where: {
      issueNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      issueNumber: 'desc',
    },
    select: {
      issueNumber: true,
    },
  });

  let nextSequence = 1;
  if (latestIssue?.issueNumber) {
    const parts = latestIssue.issueNumber.split('-');
    if (parts.length === 3) {
      const parsed = parseInt(parts[2], 10);
      if (!isNaN(parsed)) {
        nextSequence = parsed + 1;
      }
    }
  }

  return `${prefix}${String(nextSequence).padStart(6, '0')}`;
}

// ─── Component 5.1: Customer Management Server Actions ───────────────────────

/**
 * Get paginated list of customers with order counts and spend summary.
 */
export async function getCustomers(
  params?: Record<string, unknown>
): Promise<ActionResult<PaginatedResult<CustomerListItem>>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasPermission(user, PERMISSIONS.CUSTOMER_READ)) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }

    const scope = await getAuthorizedBranchScope(user);
    const branchFilter = !scope.isAllBranches ? { branchId: { in: scope.branchIds } } : undefined;

    const validated = customerFilterSchema.parse(params ?? {});
    const { search, status, page, pageSize, sortBy, sortOrder } = validated;

    const where: Prisma.CustomerWhereInput = {};

    if (status && status !== 'all') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const total = await prisma.customer.count({ where });

    // Sorting handling
    let orderBy: Prisma.CustomerOrderByWithRelationInput = { createdAt: sortOrder };
    if (sortBy === 'name') orderBy = { name: sortOrder };
    else if (sortBy === 'createdAt') orderBy = { createdAt: sortOrder };

    const customers = await prisma.customer.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        orders: {
          where: branchFilter,
          select: {
            id: true,
            status: true,
            totalAmount: true,
            createdAt: true,
          },
        },
      },
    });

    const items: CustomerListItem[] = customers.map((c) => {
      const completedOrders = c.orders.filter(
        (o) => o.status === 'COMPLETED' || o.status === 'REFUNDED'
      );
      const totalSpend = completedOrders.reduce(
        (acc, o) => acc + Number(o.totalAmount || 0),
        0
      );
      const lastOrder = c.orders.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      )[0];

      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        maskedPhone: maskPhone(c.phone),
        email: c.email,
        maskedEmail: maskEmail(c.email),
        address: c.address,
        notes: c.notes,
        status: c.status,
        totalOrders: c.orders.length,
        totalSpend: Math.round(totalSpend * 100) / 100,
        lastOrderDate: lastOrder ? lastOrder.createdAt.toISOString().split('T')[0] : null,
        createdAt: c.createdAt.toISOString().split('T')[0],
      };
    });

    // In-memory sort for derived columns if needed
    if (sortBy === 'totalOrders') {
      items.sort((a, b) =>
        sortOrder === 'asc' ? a.totalOrders - b.totalOrders : b.totalOrders - a.totalOrders
      );
    } else if (sortBy === 'totalSpend') {
      items.sort((a, b) =>
        sortOrder === 'asc' ? a.totalSpend - b.totalSpend : b.totalSpend - a.totalSpend
      );
    } else if (sortBy === 'lastOrderDate') {
      items.sort((a, b) => {
        const d1 = a.lastOrderDate || '';
        const d2 = b.lastOrderDate || '';
        return sortOrder === 'asc' ? d1.localeCompare(d2) : d2.localeCompare(d1);
      });
    }

    return {
      success: true,
      data: {
        items,
        pagination: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
          hasNextPage: page < Math.ceil(total / pageSize),
          hasPrevPage: page > 1,
        },
      },
    };
  } catch (error) {
    console.error('Error in getCustomers:', error);
    return { success: false, error: 'Failed to fetch customer directory' };
  }
}

/**
 * Get detailed customer profile, lifetime order history, reviews, and logged issues.
 */
export async function getCustomerById(id: string): Promise<ActionResult<CustomerDetail>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasPermission(user, PERMISSIONS.CUSTOMER_READ)) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }

    const scope = await getAuthorizedBranchScope(user);
    const branchFilter = !scope.isAllBranches ? { branchId: { in: scope.branchIds } } : undefined;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        orders: {
          where: branchFilter,
          include: {
            branch: { select: { id: true, name: true, code: true } },
            items: { select: { id: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        reviews: {
          where: branchFilter,
          include: {
            branch: { select: { id: true, name: true, code: true } },
            order: { select: { id: true, orderNumber: true } },
            menuItem: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        issues: {
          where: branchFilter,
          include: {
            branch: { select: { id: true, name: true, code: true } },
            order: { select: { id: true, orderNumber: true } },
            assignedStaff: {
              include: {
                user: { select: { name: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!customer) {
      return { success: false, error: 'Customer not found' };
    }

    // Derived order summary metrics
    const totalOrders = customer.orders.length;
    const completedOrders = customer.orders.filter(
      (o) => o.status === 'COMPLETED' || o.status === 'REFUNDED'
    ).length;
    const cancelledOrders = customer.orders.filter((o) => o.status === 'CANCELLED').length;
    const totalSpend = customer.orders
      .filter((o) => o.status === 'COMPLETED' || o.status === 'REFUNDED')
      .reduce((acc, o) => acc + Number(o.totalAmount || 0), 0);
    const averageOrderValue = completedOrders > 0 ? totalSpend / completedOrders : 0;
    const lastOrder = customer.orders[0];

    // Derived reviews metrics
    const reviewCount = customer.reviews.length;
    const avgRating =
      reviewCount > 0
        ? customer.reviews.reduce((acc, r) => acc + r.rating, 0) / reviewCount
        : null;

    const formattedOrders: CustomerOrderRow[] = customer.orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      branchId: o.branchId,
      branchName: o.branch.name,
      branchCode: o.branch.code,
      orderType: o.orderType,
      status: o.status,
      totalAmount: Number(o.totalAmount),
      discountAmount: Number(o.discountAmount || 0),
      itemsCount: o.items.length,
      createdAt: o.createdAt.toISOString(),
    }));

    const formattedReviews: ReviewItem[] = customer.reviews.map((r) => ({
      id: r.id,
      customerId: customer.id,
      customerName: customer.name,
      orderId: r.orderId,
      orderNumber: r.order?.orderNumber ?? null,
      branchId: r.branchId,
      branchName: r.branch.name,
      branchCode: r.branch.code,
      menuItemId: r.menuItemId,
      menuItemName: r.menuItem?.name ?? null,
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      status: r.status,
      moderatedBy: r.moderatedBy,
      moderatedAt: r.moderatedAt ? r.moderatedAt.toISOString() : null,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
    }));

    const formattedIssues: CustomerIssueItem[] = customer.issues.map((i) => ({
      id: i.id,
      issueNumber: i.issueNumber,
      customerId: customer.id,
      customerName: customer.name,
      orderId: i.orderId,
      orderNumber: i.order?.orderNumber ?? null,
      branchId: i.branchId,
      branchName: i.branch.name,
      branchCode: i.branch.code,
      type: i.type,
      priority: i.priority,
      description: i.description,
      status: i.status,
      assignedTo: i.assignedTo,
      assignedStaffName: i.assignedStaff?.user?.name || (i.assignedStaff ? `${i.assignedStaff.firstName} ${i.assignedStaff.lastName}` : null),
      assignedStaffDesignation: i.assignedStaff?.designation ?? null,
      resolutionNote: i.resolutionNote,
      createdBy: i.createdBy,
      resolvedBy: i.resolvedBy,
      resolvedAt: i.resolvedAt ? i.resolvedAt.toISOString() : null,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
    }));

    return {
      success: true,
      data: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        notes: customer.notes,
        status: customer.status,
        createdAt: customer.createdAt.toISOString(),
        updatedAt: customer.updatedAt.toISOString(),
        summary: {
          totalOrders,
          completedOrders,
          cancelledOrders,
          totalSpend: Math.round(totalSpend * 100) / 100,
          averageOrderValue: Math.round(averageOrderValue * 100) / 100,
          lastOrderDate: lastOrder ? lastOrder.createdAt.toISOString().split('T')[0] : null,
          reviewCount,
          averageRating: avgRating !== null ? Math.round(avgRating * 10) / 10 : null,
        },
        orders: formattedOrders,
        reviews: formattedReviews,
        issues: formattedIssues,
      },
    };
  } catch (error) {
    console.error('Error in getCustomerById:', error);
    return { success: false, error: 'Failed to fetch customer profile' };
  }
}

/**
 * Create a new customer profile.
 */
export async function createCustomer(
  input: CustomerInput
): Promise<ActionResult<{ id: string; name: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasPermission(user, PERMISSIONS.CUSTOMER_CREATE)) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }

    const validated = customerSchema.parse(input);

    if (validated.phone) {
      const existing = await prisma.customer.findUnique({
        where: { phone: validated.phone },
      });
      if (existing) {
        return { success: false, error: 'A customer with this phone number already exists' };
      }
    }

    const customer = await prisma.customer.create({
      data: {
        name: validated.name,
        phone: validated.phone || null,
        email: validated.email || null,
        address: validated.address || null,
        notes: validated.notes || null,
        status: 'ACTIVE',
      },
      select: { id: true, name: true },
    });

    revalidatePath('/customers');
    return { success: true, data: customer };
  } catch (error) {
    console.error('Error in createCustomer:', error);
    return { success: false, error: 'Failed to create customer' };
  }
}

/**
 * Update existing customer information.
 */
export async function updateCustomer(
  id: string,
  input: UpdateCustomerInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasPermission(user, PERMISSIONS.CUSTOMER_UPDATE)) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }

    const validated = updateCustomerSchema.parse(input);

    if (validated.phone) {
      const existing = await prisma.customer.findFirst({
        where: { phone: validated.phone, id: { not: id } },
      });
      if (existing) {
        return { success: false, error: 'Another customer has this phone number' };
      }
    }

    await prisma.customer.update({
      where: { id },
      data: {
        name: validated.name,
        phone: validated.phone || null,
        email: validated.email || null,
        address: validated.address || null,
        notes: validated.notes || null,
        status: validated.status || undefined,
      },
    });

    revalidatePath('/customers');
    revalidatePath(`/customers/${id}`);
    return { success: true, data: { id } };
  } catch (error) {
    console.error('Error in updateCustomer:', error);
    return { success: false, error: 'Failed to update customer' };
  }
}

/**
 * Toggle customer active/inactive status. Never deletes historical orders or feedback.
 */
export async function toggleCustomerStatus(id: string): Promise<ActionResult<{ status: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasPermission(user, PERMISSIONS.CUSTOMER_DEACTIVATE)) {
      return { success: false, error: 'Forbidden: Only owners and admins can deactivate customers' };
    }

    const current = await prisma.customer.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!current) return { success: false, error: 'Customer not found' };

    const newStatus = current.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    await prisma.customer.update({
      where: { id },
      data: { status: newStatus },
    });

    revalidatePath('/customers');
    revalidatePath(`/customers/${id}`);
    return { success: true, data: { status: newStatus } };
  } catch (error) {
    console.error('Error in toggleCustomerStatus:', error);
    return { success: false, error: 'Failed to update customer status' };
  }
}

// ─── Component 5.2: Review & Feedback Server Actions ─────────────────────────

/**
 * Get paginated reviews with branch scoping and filters.
 */
export async function getReviews(
  params?: Record<string, unknown>
): Promise<ActionResult<PaginatedResult<ReviewItem>>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasPermission(user, PERMISSIONS.REVIEW_READ)) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }

    const scope = await getAuthorizedBranchScope(user);
    const validated = reviewFilterSchema.parse(params ?? {});
    const { branchId, rating, status, startDate, endDate, search, page, pageSize } = validated;

    const where: Prisma.ReviewWhereInput = {};

    // Branch scoping
    if (scope.isAllBranches) {
      if (branchId && branchId !== 'all') {
        where.branchId = branchId;
      }
    } else {
      if (scope.branchIds.length === 0) {
        return {
          success: true,
          data: {
            items: [],
            pagination: { total: 0, page: 1, pageSize, totalPages: 0, hasNextPage: false, hasPrevPage: false },
          },
        };
      }
      where.branchId = { in: scope.branchIds };
    }

    if (rating && rating !== 'all') {
      where.rating = rating;
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(`${startDate}T00:00:00.000Z`);
      if (endDate) where.createdAt.lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    if (search) {
      where.OR = [
        { comment: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { order: { orderNumber: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const total = await prisma.review.count({ where });

    const reviews = await prisma.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        customer: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true, code: true } },
        order: { select: { id: true, orderNumber: true } },
        menuItem: { select: { id: true, name: true } },
      },
    });

    const items: ReviewItem[] = reviews.map((r) => ({
      id: r.id,
      customerId: r.customerId,
      customerName: r.customer?.name ?? null,
      orderId: r.orderId,
      orderNumber: r.order?.orderNumber ?? null,
      branchId: r.branchId,
      branchName: r.branch.name,
      branchCode: r.branch.code,
      menuItemId: r.menuItemId,
      menuItemName: r.menuItem?.name ?? null,
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      status: r.status,
      moderatedBy: r.moderatedBy,
      moderatedAt: r.moderatedAt ? r.moderatedAt.toISOString() : null,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
    }));

    return {
      success: true,
      data: {
        items,
        pagination: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
          hasNextPage: page < Math.ceil(total / pageSize),
          hasPrevPage: page > 1,
        },
      },
    };
  } catch (error) {
    console.error('Error in getReviews:', error);
    return { success: false, error: 'Failed to fetch customer reviews' };
  }
}

/**
 * Submit a customer review with validation of order/branch integrity.
 */
export async function createReview(
  input: CreateReviewInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const validated = createReviewSchema.parse(input);
    const scope = await getAuthorizedBranchScope(user);

    // Verify user has access to this branch
    if (!scope.isAllBranches && !scope.branchIds.includes(validated.branchId)) {
      return { success: false, error: 'Unauthorized for this branch' };
    }

    // Verify order if supplied
    if (validated.orderId) {
      const order = await prisma.order.findUnique({
        where: { id: validated.orderId },
        select: { id: true, branchId: true, customerId: true },
      });

      if (!order) {
        return { success: false, error: 'Referenced order does not exist' };
      }

      if (order.branchId !== validated.branchId) {
        return { success: false, error: 'Order does not belong to the selected branch' };
      }

      if (validated.customerId && order.customerId && order.customerId !== validated.customerId) {
        return { success: false, error: 'Order is not associated with this customer' };
      }
    }

    const review = await prisma.review.create({
      data: {
        branchId: validated.branchId,
        customerId: validated.customerId || null,
        orderId: validated.orderId || null,
        menuItemId: validated.menuItemId || null,
        rating: validated.rating,
        title: validated.title || null,
        comment: validated.comment || null,
        status: 'PUBLISHED', // Direct internal logging publishes immediately; guest portal can submit as PENDING
      },
    });

    revalidatePath('/reviews');
    revalidatePath('/feedback');
    if (validated.customerId) revalidatePath(`/customers/${validated.customerId}`);
    return { success: true, data: { id: review.id } };
  } catch (error) {
    console.error('Error in createReview:', error);
    return { success: false, error: 'Failed to submit review' };
  }
}

/**
 * Moderate review status (PUBLISH, HIDE, RESOLVE). Staff cannot rewrite customer's words.
 */
export async function moderateReview(
  input: ModerateReviewInput
): Promise<ActionResult<{ id: string; status: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasPermission(user, PERMISSIONS.REVIEW_MODERATE)) {
      return { success: false, error: 'Forbidden: Insufficient permissions to moderate reviews' };
    }

    const validated = moderateReviewSchema.parse(input);
    const scope = await getAuthorizedBranchScope(user);

    const review = await prisma.review.findUnique({
      where: { id: validated.reviewId },
      select: { branchId: true },
    });

    if (!review) return { success: false, error: 'Review not found' };

    if (!scope.isAllBranches && !scope.branchIds.includes(review.branchId)) {
      return { success: false, error: 'Unauthorized for this branch' };
    }

    const updated = await prisma.review.update({
      where: { id: validated.reviewId },
      data: {
        status: validated.status,
        moderatedBy: user.name,
        moderatedAt: new Date(),
        notes: validated.notes || undefined,
      },
    });

    revalidatePath('/reviews');
    revalidatePath('/feedback');
    return { success: true, data: { id: updated.id, status: updated.status } };
  } catch (error) {
    console.error('Error in moderateReview:', error);
    return { success: false, error: 'Failed to moderate review' };
  }
}

// ─── Component 5.3: Complaint / Issue Management Actions ─────────────────────

/**
 * Get paginated list of operational issues with branch scoping and filters.
 */
export async function getCustomerIssues(
  params?: Record<string, unknown>
): Promise<ActionResult<PaginatedResult<CustomerIssueItem>>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasPermission(user, PERMISSIONS.ISSUE_READ)) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }

    const scope = await getAuthorizedBranchScope(user);
    const validated = issueFilterSchema.parse(params ?? {});
    const { branchId, type, priority, status, assignedTo, startDate, endDate, search, page, pageSize } =
      validated;

    const where: Prisma.CustomerIssueWhereInput = {};

    if (scope.isAllBranches) {
      if (branchId && branchId !== 'all') where.branchId = branchId;
    } else {
      if (scope.branchIds.length === 0) {
        return {
          success: true,
          data: {
            items: [],
            pagination: { total: 0, page: 1, pageSize, totalPages: 0, hasNextPage: false, hasPrevPage: false },
          },
        };
      }
      where.branchId = { in: scope.branchIds };
    }

    if (type && type !== 'all') where.type = type;
    if (priority && priority !== 'all') where.priority = priority;
    if (status && status !== 'all') where.status = status;
    if (assignedTo && assignedTo !== 'all') where.assignedTo = assignedTo;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(`${startDate}T00:00:00.000Z`);
      if (endDate) where.createdAt.lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    if (search) {
      where.OR = [
        { issueNumber: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { order: { orderNumber: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const total = await prisma.customerIssue.count({ where });

    const issues = await prisma.customerIssue.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        customer: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true, code: true } },
        order: { select: { id: true, orderNumber: true } },
        assignedStaff: {
          include: {
            user: { select: { name: true } },
          },
        },
      },
    });

    const items: CustomerIssueItem[] = issues.map((i) => ({
      id: i.id,
      issueNumber: i.issueNumber,
      customerId: i.customerId,
      customerName: i.customer?.name ?? null,
      orderId: i.orderId,
      orderNumber: i.order?.orderNumber ?? null,
      branchId: i.branchId,
      branchName: i.branch.name,
      branchCode: i.branch.code,
      type: i.type,
      priority: i.priority,
      description: i.description,
      status: i.status,
      assignedTo: i.assignedTo,
      assignedStaffName: i.assignedStaff?.user?.name || (i.assignedStaff ? `${i.assignedStaff.firstName} ${i.assignedStaff.lastName}` : null),
      assignedStaffDesignation: i.assignedStaff?.designation ?? null,
      resolutionNote: i.resolutionNote,
      createdBy: i.createdBy,
      resolvedBy: i.resolvedBy,
      resolvedAt: i.resolvedAt ? i.resolvedAt.toISOString() : null,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
    }));

    return {
      success: true,
      data: {
        items,
        pagination: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
          hasNextPage: page < Math.ceil(total / pageSize),
          hasPrevPage: page > 1,
        },
      },
    };
  } catch (error) {
    console.error('Error in getCustomerIssues:', error);
    return { success: false, error: 'Failed to fetch customer issues' };
  }
}

/**
 * Log a new operational complaint or issue with sequential numbering.
 */
export async function createCustomerIssue(
  input: CreateCustomerIssueInput
): Promise<ActionResult<{ id: string; issueNumber: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasPermission(user, PERMISSIONS.ISSUE_CREATE)) {
      return { success: false, error: 'Forbidden: Insufficient permissions to log issues' };
    }

    const validated = createCustomerIssueSchema.parse(input);
    const scope = await getAuthorizedBranchScope(user);

    if (!scope.isAllBranches && !scope.branchIds.includes(validated.branchId)) {
      return { success: false, error: 'Unauthorized for this branch' };
    }

    // If assignedTo is provided, validate employee belongs to the same branch
    if (validated.assignedTo) {
      const staff = await prisma.employee.findUnique({
        where: { id: validated.assignedTo },
        select: { branchId: true },
      });
      if (!staff || staff.branchId !== validated.branchId) {
        return { success: false, error: 'Assigned employee does not belong to this branch' };
      }
    }

    // Atomic transaction for sequential issue numbering & creation
    const result = await prisma.$transaction(async (tx) => {
      const issueNumber = await generateIssueNumber(tx);

      const issue = await tx.customerIssue.create({
        data: {
          issueNumber,
          branchId: validated.branchId,
          customerId: validated.customerId || null,
          orderId: validated.orderId || null,
          type: validated.type,
          priority: validated.priority,
          description: validated.description,
          status: validated.assignedTo ? 'IN_PROGRESS' : 'OPEN',
          assignedTo: validated.assignedTo || null,
          createdBy: user.name,
        },
      });

      await tx.customerIssueAuditLog.create({
        data: {
          issueId: issue.id,
          action: 'CREATED',
          toStatus: issue.status,
          performedBy: user.name,
          userId: user.id,
          notes: `Issue ${issueNumber} registered with priority ${validated.priority}`,
        },
      });

      return issue;
    });

    revalidatePath('/feedback');
    if (validated.customerId) revalidatePath(`/customers/${validated.customerId}`);
    return { success: true, data: { id: result.id, issueNumber: result.issueNumber } };
  } catch (error) {
    console.error('Error in createCustomerIssue:', error);
    return { success: false, error: 'Failed to register customer issue' };
  }
}

/**
 * Assign an issue to a branch employee. Validates assignedEmployee.branchId === issue.branchId.
 */
export async function assignCustomerIssue(
  input: AssignIssueInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasPermission(user, PERMISSIONS.ISSUE_ASSIGN)) {
      return { success: false, error: 'Forbidden: Insufficient permissions to assign issues' };
    }

    const validated = assignIssueSchema.parse(input);
    const scope = await getAuthorizedBranchScope(user);

    const issue = await prisma.customerIssue.findUnique({
      where: { id: validated.issueId },
      select: { id: true, branchId: true, status: true },
    });

    if (!issue) return { success: false, error: 'Issue not found' };

    if (!scope.isAllBranches && !scope.branchIds.includes(issue.branchId)) {
      return { success: false, error: 'Unauthorized for this branch' };
    }

    // Strict cross-branch assignment prevention
    const staff = await prisma.employee.findUnique({
      where: { id: validated.employeeId },
      select: { id: true, branchId: true, firstName: true, lastName: true },
    });

    if (!staff) return { success: false, error: 'Employee not found' };
    if (staff.branchId !== issue.branchId) {
      return { success: false, error: 'Cross-branch assignment is strictly prohibited' };
    }

    const newStatus = issue.status === 'OPEN' ? 'IN_PROGRESS' : issue.status;

    await prisma.$transaction(async (tx) => {
      await tx.customerIssue.update({
        where: { id: validated.issueId },
        data: {
          assignedTo: staff.id,
          status: newStatus,
        },
      });

      await tx.customerIssueAuditLog.create({
        data: {
          issueId: validated.issueId,
          action: 'ASSIGNED',
          fromStatus: issue.status,
          toStatus: newStatus,
          performedBy: user.name,
          userId: user.id,
          notes: `Assigned to ${staff.firstName} ${staff.lastName}`,
        },
      });
    });

    revalidatePath('/feedback');
    return { success: true, data: { id: issue.id } };
  } catch (error) {
    console.error('Error in assignCustomerIssue:', error);
    return { success: false, error: 'Failed to assign issue' };
  }
}

/**
 * Resolve an issue with mandatory resolution note.
 */
export async function resolveCustomerIssue(
  input: ResolveIssueInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasPermission(user, PERMISSIONS.ISSUE_RESOLVE)) {
      return { success: false, error: 'Forbidden: Insufficient permissions to resolve issues' };
    }

    const validated = resolveIssueSchema.parse(input);
    const scope = await getAuthorizedBranchScope(user);

    const issue = await prisma.customerIssue.findUnique({
      where: { id: validated.issueId },
      select: { id: true, branchId: true, status: true },
    });

    if (!issue) return { success: false, error: 'Issue not found' };

    if (!scope.isAllBranches && !scope.branchIds.includes(issue.branchId)) {
      return { success: false, error: 'Unauthorized for this branch' };
    }

    if (issue.status === 'RESOLVED' || issue.status === 'CLOSED') {
      return { success: false, error: 'Issue is already resolved or closed' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.customerIssue.update({
        where: { id: validated.issueId },
        data: {
          status: 'RESOLVED',
          resolutionNote: validated.resolutionNote,
          resolvedBy: user.name,
          resolvedAt: new Date(),
        },
      });

      await tx.customerIssueAuditLog.create({
        data: {
          issueId: validated.issueId,
          action: 'RESOLVED',
          fromStatus: issue.status,
          toStatus: 'RESOLVED',
          performedBy: user.name,
          userId: user.id,
          notes: validated.resolutionNote,
        },
      });
    });

    revalidatePath('/feedback');
    return { success: true, data: { id: issue.id } };
  } catch (error) {
    console.error('Error in resolveCustomerIssue:', error);
    return { success: false, error: 'Failed to resolve issue' };
  }
}

/**
 * Update issue status following valid transitions.
 */
export async function updateIssueStatus(
  input: UpdateIssueStatusInput
): Promise<ActionResult<{ id: string; status: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasPermission(user, PERMISSIONS.ISSUE_UPDATE)) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }

    const validated = updateIssueStatusSchema.parse(input);
    const scope = await getAuthorizedBranchScope(user);

    const issue = await prisma.customerIssue.findUnique({
      where: { id: validated.issueId },
      select: { id: true, branchId: true, status: true },
    });

    if (!issue) return { success: false, error: 'Issue not found' };

    if (!scope.isAllBranches && !scope.branchIds.includes(issue.branchId)) {
      return { success: false, error: 'Unauthorized for this branch' };
    }

    // Transition validation
    const currentStatus = issue.status;
    const targetStatus = validated.status;

    if (targetStatus === 'RESOLVED' && !validated.resolutionNote) {
      return { success: false, error: 'A resolution note is required when resolving an issue' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.customerIssue.update({
        where: { id: validated.issueId },
        data: {
          status: targetStatus,
          resolutionNote: validated.resolutionNote || undefined,
          resolvedBy: targetStatus === 'RESOLVED' ? user.name : undefined,
          resolvedAt: targetStatus === 'RESOLVED' ? new Date() : undefined,
        },
      });

      await tx.customerIssueAuditLog.create({
        data: {
          issueId: validated.issueId,
          action: `STATUS_CHANGED_${targetStatus}`,
          fromStatus: currentStatus,
          toStatus: targetStatus,
          performedBy: user.name,
          userId: user.id,
          notes: validated.resolutionNote || `Status changed from ${currentStatus} to ${targetStatus}`,
        },
      });
    });

    revalidatePath('/feedback');
    return { success: true, data: { id: issue.id, status: targetStatus } };
  } catch (error) {
    console.error('Error in updateIssueStatus:', error);
    return { success: false, error: 'Failed to update issue status' };
  }
}

// ─── Component 5.4: Feedback Dashboard & Branch Analytics ───────────────────

/**
 * Get feedback dashboard metrics: reviews, ratings distribution, and open issues.
 */
export async function getFeedbackDashboardData(params?: {
  branchId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<ActionResult<FeedbackDashboardData>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasPermission(user, PERMISSIONS.REVIEW_READ)) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }

    const scope = await getAuthorizedBranchScope(user);
    const branchWhere: Record<string, unknown> = {};

    if (scope.isAllBranches) {
      if (params?.branchId && params.branchId !== 'all') {
        branchWhere.branchId = params.branchId;
      }
    } else {
      if (scope.branchIds.length === 0) {
        return {
          success: true,
          data: {
            totalReviews: 0,
            averageRating: 0,
            pendingReviews: 0,
            openIssues: 0,
            resolvedIssues: 0,
            ratingDistribution: [1, 2, 3, 4, 5].map((s) => ({ star: s, count: 0, percentage: 0 })),
            recentReviews: [],
            activeIssues: [],
          },
        };
      }
      branchWhere.branchId = { in: scope.branchIds };
    }

    const [
      totalReviews,
      pendingReviews,
      openIssues,
      resolvedIssues,
      ratingGroups,
      recentReviewsRaw,
      activeIssuesRaw,
    ] = await Promise.all([
      prisma.review.count({ where: branchWhere }),
      prisma.review.count({ where: { ...branchWhere, status: 'PENDING' } }),
      prisma.customerIssue.count({
        where: { ...branchWhere, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      }),
      prisma.customerIssue.count({ where: { ...branchWhere, status: 'RESOLVED' } }),
      prisma.review.groupBy({
        by: ['rating'],
        where: branchWhere,
        _count: { id: true },
      }),
      prisma.review.findMany({
        where: branchWhere,
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          customer: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true, code: true } },
          order: { select: { id: true, orderNumber: true } },
          menuItem: { select: { id: true, name: true } },
        },
      }),
      prisma.customerIssue.findMany({
        where: { ...branchWhere, status: { in: ['OPEN', 'IN_PROGRESS'] } },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        take: 5,
        include: {
          customer: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true, code: true } },
          order: { select: { id: true, orderNumber: true } },
          assignedStaff: {
            include: { user: { select: { name: true } } },
          },
        },
      }),
    ]);

    // Compute star distribution & average rating
    const ratingCountMap = new Map<number, number>();
    ratingGroups.forEach((g) => ratingCountMap.set(g.rating, g._count.id));

    let sumRatings = 0;
    const ratingDistribution = [5, 4, 3, 2, 1].map((star) => {
      const count = ratingCountMap.get(star) || 0;
      sumRatings += count * star;
      return {
        star,
        count,
        percentage: totalReviews > 0 ? Math.round((count / totalReviews) * 1000) / 10 : 0,
      };
    });

    const averageRating = totalReviews > 0 ? Math.round((sumRatings / totalReviews) * 10) / 10 : 0;

    const recentReviews: ReviewItem[] = recentReviewsRaw.map((r) => ({
      id: r.id,
      customerId: r.customerId,
      customerName: r.customer?.name ?? null,
      orderId: r.orderId,
      orderNumber: r.order?.orderNumber ?? null,
      branchId: r.branchId,
      branchName: r.branch.name,
      branchCode: r.branch.code,
      menuItemId: r.menuItemId,
      menuItemName: r.menuItem?.name ?? null,
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      status: r.status,
      moderatedBy: r.moderatedBy,
      moderatedAt: r.moderatedAt ? r.moderatedAt.toISOString() : null,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
    }));

    const activeIssues: CustomerIssueItem[] = activeIssuesRaw.map((i) => ({
      id: i.id,
      issueNumber: i.issueNumber,
      customerId: i.customerId,
      customerName: i.customer?.name ?? null,
      orderId: i.orderId,
      orderNumber: i.order?.orderNumber ?? null,
      branchId: i.branchId,
      branchName: i.branch.name,
      branchCode: i.branch.code,
      type: i.type,
      priority: i.priority,
      description: i.description,
      status: i.status,
      assignedTo: i.assignedTo,
      assignedStaffName: i.assignedStaff?.user?.name || (i.assignedStaff ? `${i.assignedStaff.firstName} ${i.assignedStaff.lastName}` : null),
      assignedStaffDesignation: i.assignedStaff?.designation ?? null,
      resolutionNote: i.resolutionNote,
      createdBy: i.createdBy,
      resolvedBy: i.resolvedBy,
      resolvedAt: i.resolvedAt ? i.resolvedAt.toISOString() : null,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
    }));

    return {
      success: true,
      data: {
        totalReviews,
        averageRating,
        pendingReviews,
        openIssues,
        resolvedIssues,
        ratingDistribution,
        recentReviews,
        activeIssues,
      },
    };
  } catch (error) {
    console.error('Error in getFeedbackDashboardData:', error);
    return { success: false, error: 'Failed to fetch feedback dashboard metrics' };
  }
}

/**
 * Get branch-level feedback performance comparison for owners.
 */
export async function getBranchFeedbackSummary(): Promise<
  ActionResult<BranchFeedbackSummary[]>
> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasPermission(user, PERMISSIONS.REVIEW_READ)) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }

    const scope = await getAuthorizedBranchScope(user);
    const branchQuery = scope.isAllBranches
      ? { status: 'ACTIVE' as const }
      : { id: { in: scope.branchIds }, status: 'ACTIVE' as const };

    const branches = await prisma.branch.findMany({
      where: branchQuery,
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });

    const summaries: BranchFeedbackSummary[] = [];

    for (const b of branches) {
      const [reviewCount, openIssues, resolvedIssues, ratingGroups] = await Promise.all([
        prisma.review.count({ where: { branchId: b.id } }),
        prisma.customerIssue.count({
          where: { branchId: b.id, status: { in: ['OPEN', 'IN_PROGRESS'] } },
        }),
        prisma.customerIssue.count({
          where: { branchId: b.id, status: 'RESOLVED' },
        }),
        prisma.review.groupBy({
          by: ['rating'],
          where: { branchId: b.id },
          _count: { id: true },
        }),
      ]);

      const ratingCountMap = new Map<number, number>();
      ratingGroups.forEach((g) => ratingCountMap.set(g.rating, g._count.id));

      let sumRatings = 0;
      const ratingDistribution = [5, 4, 3, 2, 1].map((star) => {
        const count = ratingCountMap.get(star) || 0;
        sumRatings += count * star;
        return {
          star,
          count,
          percentage: reviewCount > 0 ? Math.round((count / reviewCount) * 1000) / 10 : 0,
        };
      });

      const avgRating = reviewCount > 0 ? Math.round((sumRatings / reviewCount) * 10) / 10 : 0;

      summaries.push({
        branchId: b.id,
        branchName: b.name,
        branchCode: b.code,
        reviewCount,
        averageRating: avgRating,
        openIssues,
        resolvedIssues,
        ratingDistribution,
      });
    }

    return { success: true, data: summaries };
  } catch (error) {
    console.error('Error in getBranchFeedbackSummary:', error);
    return { success: false, error: 'Failed to aggregate branch feedback' };
  }
}

/**
 * Get branch staff members available for issue assignment. ZERO salary data is queried or exposed.
 */
export async function getAssignableStaff(
  branchId: string
): Promise<ActionResult<Array<{ id: string; name: string; designation: string }>>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasPermission(user, PERMISSIONS.ISSUE_ASSIGN)) {
      return { success: false, error: 'Forbidden: Insufficient permissions to assign issues' };
    }

    const scope = await getAuthorizedBranchScope(user);
    if (!isBranchAuthorized(scope, branchId)) {
      return { success: false, error: 'Forbidden: Unauthorized for this branch' };
    }

    const staff = await prisma.employee.findMany({
      where: { branchId, employmentStatus: 'ACTIVE' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        designation: true,
        user: { select: { name: true } },
      },
      orderBy: { firstName: 'asc' },
    });

    const data = staff.map((s) => ({
      id: s.id,
      name: s.user?.name || `${s.firstName} ${s.lastName}`,
      designation: s.designation,
    }));

    return { success: true, data };
  } catch (error) {
    console.error('Error in getAssignableStaff:', error);
    return { success: false, error: 'Failed to fetch branch staff' };
  }
}

// ─── Compatibility & Lookup Exports ──────────────────────────────────────────

export interface CustomerSummary {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  totalOrders: number;
  totalSpend: number;
}

export async function lookupCustomerByPhone(
  phone: string
): Promise<ActionResult<CustomerSummary | null>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const canLookup =
      hasPermission(user, PERMISSIONS.CUSTOMER_READ) ||
      hasPermission(user, PERMISSIONS.ORDER_CREATE);
    if (!canLookup) {
      return { success: false, error: 'Forbidden: Insufficient permissions to lookup customer records' };
    }

    if (!phone || !phone.trim()) {
      return { success: true, data: null };
    }

    const clean = phone.trim();
    const customer = await prisma.customer.findFirst({
      where: {
        phone: { contains: clean, mode: 'insensitive' },
        status: 'ACTIVE',
      },
    });

    if (!customer) {
      return { success: true, data: null };
    }

    const scope = await getAuthorizedBranchScope(user);
    const branchFilter = !scope.isAllBranches ? { branchId: { in: scope.branchIds } } : undefined;

    const orders = await prisma.order.findMany({
      where: {
        customerId: customer.id,
        ...(branchFilter && branchFilter),
      },
      select: {
        id: true,
        status: true,
        payments: {
          where: { status: 'SUCCESS' },
          select: { amount: true },
        },
      },
    });

    const completedOrders = orders.filter((o) => o.status === 'COMPLETED');
    const totalSpend = orders.reduce((sum, o) => {
      return sum + o.payments.reduce((pSum, p) => pSum + Number(p.amount), 0);
    }, 0);

    return {
      success: true,
      data: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        totalOrders: completedOrders.length,
        totalSpend,
      },
    };
  } catch (error) {
    console.error('Error in lookupCustomerByPhone:', error);
    return { success: false, error: 'Failed to look up customer' };
  }
}

export const submitReview = createReview;
export const updateCustomerIssueStatus = updateIssueStatus;
export const getCustomerDetail = getCustomerById;
