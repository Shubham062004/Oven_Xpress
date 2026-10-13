import { prisma } from '@/lib/db/prisma';

export interface AdminDashboardData {
  metrics: {
    totalUsers: number;
    activeUsers: number;
    totalBranches: number;
    activeBranches: number;
    totalEmployees: number;
    auditEventsCount: number;
  };
  recentUsers: Array<{
    id: string;
    name: string;
    email: string;
    roleName: string;
    isActive: boolean;
    createdAt: string;
  }>;
  recentAuditLogs: Array<{
    id: string;
    action: string;
    description: string;
    userName: string;
    createdAt: string;
  }>;
  branches: Array<{
    id: string;
    name: string;
    code: string;
    city: string;
    status: string;
  }>;
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const [
    totalUsers,
    activeUsers,
    totalBranches,
    activeBranches,
    totalEmployees,
    auditEventsCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.branch.count(),
    prisma.branch.count({ where: { status: 'ACTIVE' } }),
    prisma.employee.count(),
    prisma.auditLog.count(),
  ]);

  const recentUsersRaw = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 6,
    include: { role: true },
  });

  const recentUsers = recentUsersRaw.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    roleName: u.role.name,
    isActive: u.isActive,
    createdAt: u.createdAt.toLocaleDateString(),
  }));

  const recentAuditRaw = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 6,
    include: { actorUser: { select: { name: true } } },
  });

  const recentAuditLogs = recentAuditRaw.map((a) => ({
    id: a.id,
    action: a.action,
    description: a.description,
    userName: a.actorUser?.name || 'System',
    createdAt: a.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }));

  const branchesRaw = await prisma.branch.findMany({
    orderBy: { name: 'asc' },
    take: 8,
    select: { id: true, name: true, code: true, city: true, status: true },
  });

  return {
    metrics: {
      totalUsers,
      activeUsers,
      totalBranches,
      activeBranches,
      totalEmployees,
      auditEventsCount,
    },
    recentUsers,
    recentAuditLogs,
    branches: branchesRaw,
  };
}
