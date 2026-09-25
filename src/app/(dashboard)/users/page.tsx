import { requirePermission, getAuthorizedBranchScope } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CheckCircle2, Shield, UserX } from 'lucide-react';

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

  const getRoleBadgeVariant = (roleName: string) => {
    switch (roleName) {
      case 'OWNER':
        return 'default';
      case 'ADMIN':
        return 'secondary';
      case 'MANAGER':
        return 'outline';
      default:
        return 'ghost';
    }
  };

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
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No users found. Run database seed to populate accounts.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {u.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(u.role.name)}>
                          {u.role.name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                            <CheckCircle2 className="size-3.5" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                            <UserX className="size-3.5" />
                            Inactive
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
