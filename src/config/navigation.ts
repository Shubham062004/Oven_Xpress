import {
  Building2,
  ChefHat,
  Banknote,
  CreditCard,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Truck,
  UserCheck,
  Users,
  UtensilsCrossed,
  TrendingUp,
  FileSpreadsheet,
  Star,
  MessageSquare,
  Bell,
  ScrollText,
  Bug,
  Tag,
} from 'lucide-react';

import { PERMISSIONS } from '@/lib/permissions/definitions';

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredPermission?: string;
}

export const mainNavItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    requiredPermission: PERMISSIONS.DASHBOARD_READ,
  },
  {
    label: 'Notifications',
    href: '/notifications',
    icon: Bell,
    requiredPermission: PERMISSIONS.NOTIFICATION_READ,
  },
  {
    label: 'Branches',
    href: '/branches',
    icon: Building2,
    requiredPermission: PERMISSIONS.BRANCH_READ,
  },
  {
    label: 'Employees',
    href: '/employees',
    icon: Users,
    requiredPermission: PERMISSIONS.EMPLOYEE_READ,
  },
  {
    label: 'System Users',
    href: '/users',
    icon: Shield,
    requiredPermission: PERMISSIONS.USERS_READ,
  },
  {
    label: 'Attendance',
    href: '/attendance',
    icon: UserCheck,
    requiredPermission: PERMISSIONS.ATTENDANCE_READ,
  },
  {
    label: 'Menu',
    href: '/menu',
    icon: UtensilsCrossed,
    requiredPermission: PERMISSIONS.MENU_ITEM_READ,
  },
  {
    label: 'Orders',
    href: '/orders',
    icon: ShoppingCart,
    requiredPermission: PERMISSIONS.ORDER_READ,
  },
  {
    label: 'Payments',
    href: '/payments',
    icon: CreditCard,
    requiredPermission: PERMISSIONS.PAYMENT_READ,
  },
  {
    label: 'Kitchen',
    href: '/kitchen',
    icon: ChefHat,
    requiredPermission: PERMISSIONS.KITCHEN_READ,
  },
  {
    label: 'Inventory',
    href: '/inventory',
    icon: Package,
    requiredPermission: PERMISSIONS.INVENTORY_READ,
  },
  {
    label: 'Purchases',
    href: '/purchases',
    icon: ShoppingBag,
    requiredPermission: PERMISSIONS.PURCHASE_READ,
  },
  {
    label: 'Suppliers',
    href: '/suppliers',
    icon: Truck,
    requiredPermission: PERMISSIONS.SUPPLIER_READ,
  },
  {
    label: 'Expenses',
    href: '/expenses',
    icon: Receipt,
    requiredPermission: PERMISSIONS.EXPENSE_READ,
  },
  {
    label: 'Salaries',
    href: '/salary',
    icon: Banknote,
    requiredPermission: PERMISSIONS.SALARY_READ,
  },
  {
    label: 'Customers',
    href: '/customers',
    icon: Users,
    requiredPermission: PERMISSIONS.CUSTOMER_READ,
  },
  {
    label: 'Reviews',
    href: '/reviews',
    icon: Star,
    requiredPermission: PERMISSIONS.REVIEW_READ,
  },
  {
    label: 'Feedback',
    href: '/feedback',
    icon: MessageSquare,
    requiredPermission: PERMISSIONS.REVIEW_READ,
  },
  {
    label: 'Sales',
    href: '/sales',
    icon: TrendingUp,
    requiredPermission: PERMISSIONS.REPORT_SALES_READ,
  },
  {
    label: 'Reports',
    href: '/reports',
    icon: FileSpreadsheet,
    requiredPermission: PERMISSIONS.REPORT_SALES_READ,
  },
  {
    label: 'Audit Logs',
    href: '/audit-logs',
    icon: ScrollText,
    requiredPermission: PERMISSIONS.AUDIT_READ,
  },
  {
    label: 'Coupons & Offers',
    href: '/coupons',
    icon: Tag,
    requiredPermission: PERMISSIONS.COUPON_READ,
  },
  {
    label: 'Bug Reports',
    href: '/bug-reports',
    icon: Bug,
    requiredPermission: PERMISSIONS.BUG_REPORT_READ,
  },
];

export const bottomNavItems: NavItem[] = [
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    requiredPermission: PERMISSIONS.SETTINGS_READ,
  },
];

/**
 * Authoritative mapping of permitted subpaths for each role workspace.
 * Prevents unauthorized links from being displayed and enforces strict workspace boundaries.
 */
export const ROLE_ALLOWED_SUBPATHS: Record<string, string[]> = {
  owner: [
    '',
    'dashboard',
    'branches',
    'employees',
    'users',
    'attendance',
    'menu',
    'orders',
    'payments',
    'kitchen',
    'inventory',
    'purchases',
    'suppliers',
    'expenses',
    'salary',
    'salaries',
    'customers',
    'coupons',
    'reviews',
    'feedback',
    'sales',
    'reports',
    'audit-logs',
    'bug-reports',
    'settings',
    'notifications',
    'profile',
  ],
  admin: [
    '',
    'dashboard',
    'users',
    'branches',
    'employees',
    'coupons',
    'attendance',
    'audit-logs',
    'settings',
    'notifications',
    'profile',
  ],
  manager: [
    '',
    'dashboard',
    'orders',
    'kitchen',
    'inventory',
    'purchases',
    'suppliers',
    'employees',
    'attendance',
    'menu',
    'payments',
    'expenses',
    'customers',
    'feedback',
    'reviews',
    'reports',
    'sales',
    'notifications',
    'profile',
  ],
  staff: [
    '',
    'dashboard',
    'orders',
    'kitchen',
    'attendance',
    'menu',
    'inventory',
    'customers',
    'payments',
    'expenses',
    'notifications',
    'profile',
  ],
};

/**
 * Returns navigation items strictly filtered and URL-prefixed for the user's role workspace.
 * e.g. Owner gets /owner/branches, Staff gets /staff/orders.
 */
export function getRoleNavItems(role: string, items: NavItem[]): NavItem[] {
  const normalizedRole = (role || 'staff').toLowerCase();
  const allowed =
    ROLE_ALLOWED_SUBPATHS[normalizedRole] || ROLE_ALLOWED_SUBPATHS.staff;

  return items
    .filter((item) => {
      const subpath = item.href === '/' ? '' : item.href.replace(/^\//, '');
      const rootSegment = subpath.split('/')[0];
      return allowed.includes(rootSegment);
    })
    .map((item) => ({
      ...item,
      href:
        item.href === '/'
          ? `/${normalizedRole}`
          : `/${normalizedRole}${item.href}`,
    }));
}
