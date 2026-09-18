import {
  BarChart3,
  Building2,
  ChefHat,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  Truck,
  UserCheck,
  Users,
  UtensilsCrossed,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const mainNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Branches', href: '/branches', icon: Building2 },
  { label: 'Staff', href: '/staff', icon: Users },
  { label: 'Attendance', href: '/attendance', icon: UserCheck },
  { label: 'Menu', href: '/menu', icon: UtensilsCrossed },
  { label: 'Orders', href: '/orders', icon: ShoppingCart },
  { label: 'Kitchen', href: '/kitchen', icon: ChefHat },
  { label: 'Inventory', href: '/inventory', icon: Package },
  { label: 'Suppliers', href: '/suppliers', icon: Truck },
  { label: 'Expenses', href: '/expenses', icon: CreditCard },
  { label: 'Salaries', href: '/salaries', icon: ClipboardList },
  { label: 'Customers', href: '/customers', icon: Users },
  { label: 'Reports', href: '/reports', icon: FileText },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
];

export const bottomNavItems: NavItem[] = [
  { label: 'Settings', href: '/settings', icon: Settings },
];
