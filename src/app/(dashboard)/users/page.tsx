import { requirePermission, getAuthorizedBranchScope } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield } from 'lucide-react';
import { UserListClient } from '@/components/users/user-list-client';

export const metadata = {
  title: 'Staff & Users',
  description: 'Manage users and role-based permissions',
};

export default async function UsersPage() {
  // Server-side guard: Enforces that user has 'users.read' permission
  const currentUser = await requirePermission(PERMISSIONS.USERS_READ);
  const scope = await getAuthorizedBranchScope(currentUser);

  let users: Array<{
    id: string;
    name: string;
    email: string;
    isActive: boolean;
    createdAt: Date;
    role: { name: string };
  }> = [];

  try {
    const where = !scope.isAllBranches
      ? { employee: { branchId: { in: scope.branchIds } } }
      : {};

    users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        createdAt: true,
        role: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  } catch (err) {
    console.error('Failed to load users from database:', err);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff & User Management"
        description="View registered system users and their assigned access roles"
      />

      <Card className="border-border/80">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Application Accounts</CardTitle>
              <CardDescription>
                Guarded on server by{' '}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                  requirePermission(&apos;users.read&apos;)
                </code>
              </CardDescription>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Shield className="size-4 text-primary" />
              <span>Viewing as {currentUser.role}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <UserListClient users={users} />
        </CardContent>
      </Card>
    </div>
  );
}
