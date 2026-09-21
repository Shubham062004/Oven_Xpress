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
    href: '/reports/profit-loss',
    icon: FileSpreadsheet,
    requiredPermission: PERMISSIONS.REPORT_FINANCE_READ,
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
