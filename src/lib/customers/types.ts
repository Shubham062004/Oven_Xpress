/**
 * Customer Management, Reviews & Feedback — Type Definitions
 */

import type {
  CustomerStatus,
  ReviewStatus,
  IssueType,
  IssuePriority,
  IssueStatus,
} from '@prisma/client';

export type { CustomerStatus, ReviewStatus, IssueType, IssuePriority, IssueStatus };

// ─── Customer Directory & Summary ────────────────────────────────────────────

export interface CustomerListItem {
  id: string;
  name: string;
  phone: string | null;
  maskedPhone: string | null;
  email: string | null;
  maskedEmail: string | null;
  address: string | null;
  notes: string | null;
  status: CustomerStatus;
  totalOrders: number;
  totalSpend: number;
  lastOrderDate: string | null;
  createdAt: string;
}

export interface CustomerOrderSummary {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalSpend: number;
  averageOrderValue: number;
  lastOrderDate: string | null;
  reviewCount: number;
  averageRating: number | null;
}

export interface CustomerOrderRow {
  id: string;
  orderNumber: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  orderType: string;
  status: string;
  totalAmount: number;
  discountAmount: number;
  itemsCount: number;
  createdAt: string;
}

export interface CustomerDetail {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  status: CustomerStatus;
  createdAt: string;
  updatedAt: string;
  summary: CustomerOrderSummary;
  orders: CustomerOrderRow[];
  reviews: ReviewItem[];
  issues: CustomerIssueItem[];
}

export interface CustomerFilterInput {
  search?: string;
  branchId?: string;
  status?: CustomerStatus | 'all';
  page?: number;
  pageSize?: number;
  sortBy?: 'name' | 'totalOrders' | 'totalSpend' | 'lastOrderDate' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

// ─── Reviews & Feedback ──────────────────────────────────────────────────────

export interface ReviewItem {
  id: string;
  customerId: string | null;
  customerName: string | null;
  orderId: string | null;
  orderNumber: string | null;
  branchId: string;
  branchName: string;
  branchCode: string;
  menuItemId: string | null;
  menuItemName: string | null;
  rating: number; // 1 to 5
  title: string | null;
  comment: string | null;
  status: ReviewStatus;
  moderatedBy: string | null;
  moderatedAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface ReviewFilterInput {
  branchId?: string;
  rating?: number | 'all';
  status?: ReviewStatus | 'all';
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

// ─── Customer Issues & Complaints ────────────────────────────────────────────

export interface CustomerIssueItem {
  id: string;
  issueNumber: string;
  customerId: string | null;
  customerName: string | null;
  orderId: string | null;
  orderNumber: string | null;
  branchId: string;
  branchName: string;
  branchCode: string;
  type: IssueType;
  priority: IssuePriority;
  description: string;
  status: IssueStatus;
  assignedTo: string | null;
  assignedStaffName: string | null;
  assignedStaffDesignation: string | null;
  resolutionNote: string | null;
  createdBy: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerIssueAuditItem {
  id: string;
  action: string;
  fromStatus: IssueStatus | null;
  toStatus: IssueStatus | null;
  performedBy: string;
  notes: string | null;
  createdAt: string;
}

export interface CustomerIssueDetail extends CustomerIssueItem {
  auditLogs: CustomerIssueAuditItem[];
}

export interface IssueFilterInput {
  branchId?: string;
  type?: IssueType | 'all';
  priority?: IssuePriority | 'all';
  status?: IssueStatus | 'all';
  assignedTo?: string | 'all';
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

// ─── Feedback Dashboard & Branch Aggregations ────────────────────────────────

export interface RatingDistribution {
  star: number; // 1 to 5
  count: number;
  percentage: number;
}

export interface FeedbackDashboardData {
  totalReviews: number;
  averageRating: number;
  pendingReviews: number;
  openIssues: number;
  resolvedIssues: number;
  ratingDistribution: RatingDistribution[];
  recentReviews: ReviewItem[];
  activeIssues: CustomerIssueItem[];
}

export interface BranchFeedbackSummary {
  branchId: string;
  branchName: string;
  branchCode: string;
  reviewCount: number;
  averageRating: number;
  openIssues: number;
  resolvedIssues: number;
  ratingDistribution: RatingDistribution[];
}

// ─── Pagination Metadata ─────────────────────────────────────────────────────

export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationMeta;
}

export type CustomerItem = CustomerListItem;
export type CustomerDetailData = CustomerDetail;
