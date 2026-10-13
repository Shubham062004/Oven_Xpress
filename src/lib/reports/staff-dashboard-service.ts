import { prisma } from '@/lib/db/prisma';
import { OrderStatus } from '@prisma/client';
import { getOrSetCache, CACHE_KEYS } from '@/lib/cache/cache-service';

export interface StaffDashboardData {
  employee: {
    name: string;
    email: string;
    designation: string;
    employeeCode: string;
    branchName: string;
    branchId: string;
  };
  todayAttendance: {
    status: string;
    checkInTime: string | null;
    checkOutTime: string | null;
  } | null;
  orderMetrics: {
    totalToday: number;
    activeOrders: number;
    readyForPickup: number;
    completedToday: number;
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
  kitchenQueueCount: number;
}

export async function getStaffDashboardData(userId: string): Promise<StaffDashboardData> {
  return getOrSetCache(CACHE_KEYS.dashboardStaff(userId), 20, async () => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    select: {
      name: true,
      email: true,
      employee: {
        select: {
          id: true,
          designation: true,
          employeeCode: true,
          branchId: true,
          branch: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  const branchId = user?.employee?.branchId;
  const employeeId = user?.employee?.id;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const orderWhere = branchId ? { branchId } : {};

  // Parallelize all staff dashboard data queries in a single Promise.all
  const [
    attendanceRecord,
    totalOrdersToday,
    activeOrdersCount,
    readyOrdersCount,
    completedOrdersCount,
    recentOrdersRaw,
    kitchenQueueCount,
  ] = await Promise.all([
    employeeId
      ? prisma.attendance.findFirst({
          where: {
            employeeId,
            date: { gte: startOfDay, lte: endOfDay },
          },
          orderBy: { createdAt: 'desc' },
          select: {
            status: true,
            checkIn: true,
            checkOut: true,
          },
        })
      : Promise.resolve(null),
    prisma.order.count({
      where: {
        ...orderWhere,
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
    }),
    prisma.order.count({
      where: {
        ...orderWhere,
        status: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PREPARING] },
      },
    }),
    prisma.order.count({
      where: {
        ...orderWhere,
        status: OrderStatus.READY,
      },
    }),
    prisma.order.count({
      where: {
        ...orderWhere,
        status: OrderStatus.COMPLETED,
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
    }),
    prisma.order.findMany({
      where: orderWhere,
      orderBy: { createdAt: 'desc' },
      take: 6,
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
    prisma.order.count({
      where: {
        status: { in: [OrderStatus.CONFIRMED, OrderStatus.PREPARING] },
        ...(branchId ? { branchId } : {}),
      },
    }),
  ]);

  const todayAttendance: StaffDashboardData['todayAttendance'] = attendanceRecord
    ? {
        status: attendanceRecord.status,
        checkInTime: attendanceRecord.checkIn
          ? attendanceRecord.checkIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : null,
        checkOutTime: attendanceRecord.checkOut
          ? attendanceRecord.checkOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : null,
      }
    : null;

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
    employee: {
      name: user?.name || 'Staff Member',
      email: user?.email || '',
      designation: user?.employee?.designation || 'Service Staff',
      employeeCode: user?.employee?.employeeCode || 'STF-001',
      branchName: user?.employee?.branch?.name || 'Assigned Branch',
      branchId: branchId || '',
    },
    todayAttendance,
    orderMetrics: {
      totalToday: totalOrdersToday,
      activeOrders: activeOrdersCount,
      readyForPickup: readyOrdersCount,
      completedToday: completedOrdersCount,
    },
    recentOrders,
    kitchenQueueCount,
  };
  });
}
