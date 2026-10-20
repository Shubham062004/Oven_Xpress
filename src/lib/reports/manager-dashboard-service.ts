import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { OrderStatus } from '@prisma/client';
import { calculateBatchStock } from '@/lib/inventory/actions';
import { getOrSetCache, CACHE_KEYS } from '@/lib/cache/cache-service';

export interface ManagerDashboardData {
  branch: {
    id: string;
    name: string;
    code: string;
    city: string;
  };
  metrics: {
    todayRevenue: number;
    todayOrdersCount: number;
    activeOrdersCount: number;
    staffClockedInCount: number;
    totalBranchStaff: number;
    lowStockItemsCount: number;
  };
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    totalAmount: number;
    status: string;
    orderType: string;
    createdAt: string;
  }>;
  lowStockItems: Array<{
    id: string;
    name: string;
    currentStock: number;
    minThreshold: number;
    unit: string;
  }>;
}

export async function getManagerDashboardData(userId: string): Promise<ManagerDashboardData> {
  return getOrSetCache(CACHE_KEYS.dashboardManager(userId), 30, async () => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    select: {
      employee: {
        select: {
          branch: {
            select: {
              id: true,
              name: true,
              code: true,
              city: true,
            },
          },
        },
      },
    },
  });

  // If user has no employee or branch (or is OWNER viewing manager mode), grab first branch
  let branch = user?.employee?.branch;
  if (!branch) {
    branch = (await prisma.branch.findFirst({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        code: true,
        city: true,
      },
    })) || undefined;
  }

  const branchId = branch?.id || '';

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  // Run all primary dashboard aggregations and queries in parallel
  const [
    todayRevenueAgg,
    todayOrdersCount,
    activeOrdersCount,
    totalBranchStaff,
    staffClockedInCount,
    inventoryItems,
    recentOrdersRaw,
  ] = await Promise.all([
    // Completed revenue today (DB aggregation instead of in-memory filter)
    prisma.order.aggregate({
      where: {
        ...(branchId ? { branchId } : {}),
        createdAt: { gte: startOfDay, lte: endOfDay },
        status: OrderStatus.COMPLETED,
      },
      _sum: { totalAmount: true },
    }),
    // Total orders received today
    prisma.order.count({
      where: {
        ...(branchId ? { branchId } : {}),
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
    }),
    // Active orders in progress
    prisma.order.count({
      where: {
        ...(branchId ? { branchId } : {}),
        status: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY] },
      },
    }),
    // Active staff headcount
    prisma.employee.count({
      where: {
        ...(branchId ? { branchId } : {}),
        employmentStatus: 'ACTIVE',
      },
    }),
    // Staff clocked in today
    prisma.attendance.count({
      where: {
        ...(branchId ? { branchId } : {}),
        date: { gte: startOfDay, lte: endOfDay },
        status: 'PRESENT',
      },
    }),
    // Active inventory items for threshold checking
    prisma.inventoryItem.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        status: 'ACTIVE',
      },
      include: {
        ingredient: { select: { name: true, unit: true } },
      },
      take: 20,
    }),
    // Recent orders
    prisma.order.findMany({
      where: branchId ? { branchId } : {},
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        totalAmount: true,
        status: true,
        orderType: true,
        createdAt: true,
      },
    }),
  ]);

  const todayRevenue = Number(todayRevenueAgg._sum.totalAmount || 0);

  // Bounded batch stock calculation: only scan transactions for the active inventory ingredients
  const ingredientIds = inventoryItems.map((item) => item.ingredientId);
  const stockMap = ingredientIds.length > 0
    ? await calculateBatchStock(branchId ? [branchId] : [], ingredientIds)
    : new Map<string, number>();

  const lowStock = inventoryItems
    .map((item) => {
      const currentStock = stockMap.get(`${item.branchId}:${item.ingredientId}`) || 0;
      const minThreshold = Number(item.minimumStock);
      return {
        id: item.id,
        name: item.ingredient?.name || 'Raw Material',
        currentStock,
        minThreshold,
        unit: item.ingredient?.unit || 'UNIT',
      };
    })
    .filter((item) => item.currentStock <= item.minThreshold);

  const lowStockItems = lowStock.slice(0, 5);

  const recentOrders = recentOrdersRaw.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    customerName: o.customerName || 'Walk-in Guest',
    totalAmount: Number(o.totalAmount),
    status: o.status,
    orderType: o.orderType,
    createdAt: o.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }));

  return {
    branch: {
      id: branch?.id || '',
      name: branch?.name || 'Central Branch',
      code: branch?.code || 'OX-01',
      city: branch?.city || 'HQ',
    },
    metrics: {
      todayRevenue,
      todayOrdersCount,
      activeOrdersCount,
      staffClockedInCount,
      totalBranchStaff,
      lowStockItemsCount: lowStock.length,
    },
    recentOrders,
    lowStockItems,
  };
  });
}
