'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  FileSpreadsheet,
  TrendingUp,
  ShoppingCart,
  UtensilsCrossed,
  Building2,
  CreditCard,
  Receipt,
  Package,
  ShoppingBag,
  Trash2,
  UserCheck,
  Banknote,
  Users,
  Star,
  Search,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';

export interface ReportHubCardDef {
  id: string;
  title: string;
  description: string;
  category: 'Sales & Orders' | 'Financial Flow' | 'Operations & Inventory' | 'Workforce & HR' | 'Customer Experience';
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredPermission: string;
  filters: string[];
}

export const ALL_REPORTS: ReportHubCardDef[] = [
  // ─── 1. Sales & Orders
  {
    id: 'sales',
    title: 'Sales Report',
    description: 'View daily sales, order count, promotional discounts, customer refunds, and net revenue.',
    category: 'Sales & Orders',
    href: '/reports/sales',
    icon: TrendingUp,
    requiredPermission: 'report.sales.read',
    filters: ['Date Presets', 'Branch', 'Custom Date Range'],
  },
  {
    id: 'orders',
    title: 'Orders Report',
    description: 'View detailed order records, dining channels (Dine-in, Takeaway, Delivery), statuses, and ticket subtotals.',
    category: 'Sales & Orders',
    href: '/reports/orders',
    icon: ShoppingCart,
    requiredPermission: 'order.read',
    filters: ['Date', 'Branch', 'Order Type', 'Status', 'Search'],
  },
  {
    id: 'products',
    title: 'Product Sales Report',
    description: 'View factual menu item sales velocity, dish quantities sold, gross revenue, and category breakdown.',
    category: 'Sales & Orders',
    href: '/reports/products',
    icon: UtensilsCrossed,
    requiredPermission: 'menu.item.read',
    filters: ['Date', 'Branch', 'Category', 'Search'],
  },
  {
    id: 'branches',
    title: 'Branch Performance Report',
    description: 'View factual, side-by-side operational benchmarks across accessible restaurant locations.',
    category: 'Sales & Orders',
    href: '/reports/branches',
    icon: Building2,
    requiredPermission: 'report.branch.read',
    filters: ['Date Presets', 'Sort Column'],
  },

  // ─── 2. Financial Flow
  {
    id: 'payments',
    title: 'Payment Report',
    description: 'View collected tenders across Cash, UPI, Card, and Online channels with settlement statuses.',
    category: 'Financial Flow',
    href: '/reports/payments',
    icon: CreditCard,
    requiredPermission: 'payment.read',
    filters: ['Date', 'Branch', 'Tender Method', 'Status', 'Search'],
  },
  {
    id: 'expenses',
    title: 'Expense Report',
    description: 'View operating expenses, vendor disbursements, categories, and management approval statuses.',
    category: 'Financial Flow',
    href: '/reports/expenses',
    icon: Receipt,
    requiredPermission: 'expense.read',
    filters: ['Date', 'Branch', 'Category', 'Status', 'Search'],
  },
  {
    id: 'profit-loss',
    title: 'Profit & Operating Result',
    description: 'View operational management statement comparing net revenue against approved operating expenses and payroll.',
    category: 'Financial Flow',
    href: '/reports/profit-loss',
    icon: FileSpreadsheet,
    requiredPermission: 'report.finance.read',
    filters: ['Date Presets', 'Branch'],
  },
  {
    id: 'compensation',
    title: 'Compensation Report',
    description: 'View employee base salary structures, approved bonuses, incentives, and gross payroll periods.',
    category: 'Financial Flow',
    href: '/reports/compensation',
    icon: Banknote,
    requiredPermission: 'salary.read',
    filters: ['Branch', 'Month/Year', 'Status', 'Search'],
  },

  // ─── 3. Operations & Inventory
  {
    id: 'inventory',
    title: 'Inventory & Stock Report',
    description: 'View ledger-derived current ingredient balances, safety thresholds, and chronological movements.',
    category: 'Operations & Inventory',
    href: '/reports/inventory',
    icon: Package,
    requiredPermission: 'inventory.read',
    filters: ['Branch', 'Health Status', 'Search'],
  },
  {
    id: 'purchases',
    title: 'Purchases Report',
    description: 'View vendor purchase orders, fulfillment progress, and ordered versus received invoice values.',
    category: 'Operations & Inventory',
    href: '/reports/purchases',
    icon: ShoppingBag,
    requiredPermission: 'purchase.read',
    filters: ['Date', 'Branch', 'Supplier', 'Status', 'Search'],
  },
  {
    id: 'wastage',
    title: 'Wastage & Damage Report',
    description: 'View recorded ingredient spoilage, kitchen damages, and loss breakdowns by reason and item.',
    category: 'Operations & Inventory',
    href: '/reports/wastage',
    icon: Trash2,
    requiredPermission: 'inventory.read',
    filters: ['Date', 'Branch', 'Wastage Reason', 'Search'],
  },

  // ─── 4. Workforce & HR
  {
    id: 'attendance',
    title: 'Attendance Report',
    description: 'View shift attendance facts, check-in/out records, late arrival minutes, and early departures.',
    category: 'Workforce & HR',
    href: '/reports/attendance',
    icon: UserCheck,
    requiredPermission: 'attendance.read',
    filters: ['Date', 'Branch', 'Shift', 'Status', 'Search'],
  },

  // ─── 5. Customer Experience
  {
    id: 'customers',
    title: 'Customers Report',
    description: 'View patron order frequencies, lifetime spend, customer loyalty, and historical review ratings.',
    category: 'Customer Experience',
    href: '/reports/customers',
    icon: Users,
    requiredPermission: 'customer.read',
    filters: ['Branch', 'Status', 'Search'],
  },
  {
    id: 'reviews',
    title: 'Reviews & Feedback Report',
    description: 'View customer ratings, review volume, moderation statuses, and guest feedback comments.',
    category: 'Customer Experience',
    href: '/reports/reviews',
    icon: Star,
    requiredPermission: 'review.read',
    filters: ['Date', 'Branch', 'Star Rating', 'Status', 'Search'],
  },
];

interface ReportHubClientProps {
  userPermissions: string[];
  isOwnerOrAdmin?: boolean;
  isOwner?: boolean;
}

export function ReportHubClient({ userPermissions, isOwnerOrAdmin, isOwner }: ReportHubClientProps) {
  const isSuper = Boolean(isOwnerOrAdmin || isOwner);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Filter reports according to user permissions
  const permittedReports = useMemo(() => {
    return ALL_REPORTS.filter((report) => {
      if (isSuper) return true;
      return userPermissions.includes(report.requiredPermission);
    });
  }, [userPermissions, isSuper]);

  // Filter by search text and category
  const filteredReports = useMemo(() => {
    return permittedReports.filter((report) => {
      const matchesSearch =
        search === '' ||
        report.title.toLowerCase().includes(search.toLowerCase()) ||
        report.description.toLowerCase().includes(search.toLowerCase()) ||
        report.category.toLowerCase().includes(search.toLowerCase());

      const matchesCategory =
        selectedCategory === 'all' || report.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [permittedReports, search, selectedCategory]);

  const categories = useMemo(() => {
    const set = new Set(permittedReports.map((r) => r.category));
    return Array.from(set);
  }, [permittedReports]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8">
      {/* ─── Header ─── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                Business Reports & Export Center
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Centralized operational reporting, data export, and audit-grade analytics across all store functions.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Search & Category Filter Bar ─── */}
      <Card className="border border-border/60 shadow-xs p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search reports by name, description, or module..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all shrink-0 ${
                selectedCategory === 'all'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/40 text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              All Categories ({permittedReports.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-muted/40 text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* ─── Reports Grid ─── */}
      {filteredReports.length === 0 ? (
        <div className="text-center py-16 bg-muted/10 border border-dashed rounded-xl p-8">
          <Filter className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
          <h3 className="text-sm font-semibold text-foreground">No matching reports found</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Try adjusting your search keywords or switching category filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReports.map((report) => {
            const Icon = report.icon;
            return (
              <Link key={report.id} href={report.href} className="group block focus:outline-hidden">
                <Card className="h-full border border-border/60 hover:border-primary/50 transition-all shadow-xs hover:shadow-md flex flex-col justify-between p-5 group-hover:bg-accent/5">
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <Icon className="h-5 w-5" />
                      </div>
                      <Badge variant="secondary" className="text-[10px] font-medium tracking-wide">
                        {report.category}
                      </Badge>
                    </div>

                    <CardTitle className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                      {report.title}
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      {report.description}
                    </CardDescription>
                  </div>

                  <div className="mt-5 pt-4 border-t border-border/40 space-y-3">
                    {/* Available Filters Tags */}
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[10px] text-muted-foreground font-medium mr-1">Filters:</span>
                      {report.filters.map((f, i) => (
                        <span
                          key={i}
                          className="inline-block text-[9px] px-1.5 py-0.5 rounded-sm bg-muted/60 text-muted-foreground"
                        >
                          {f}
                        </span>
                      ))}
                    </div>

                    {/* Action Link */}
                    <div className="flex items-center text-xs font-semibold text-primary group-hover:translate-x-0.5 transition-transform">
                      <span>View & Export Report</span>
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
