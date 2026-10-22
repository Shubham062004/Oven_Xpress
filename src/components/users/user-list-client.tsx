'use client';

import { useState, useMemo } from 'react';
import { Search, CheckCircle2, UserX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTablePagination } from '@/components/ui/data-table-pagination';

export interface UserItem {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: Date | string;
  role: { name: string };
}

interface UserListClientProps {
  users: UserItem[];
}

export function UserListClient({ users }: UserListClientProps) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Available roles from users list
  const availableRoles = useMemo(() => {
    const roles = new Set<string>();
    users.forEach((u) => {
      if (u.role?.name) roles.add(u.role.name);
    });
    return Array.from(roles).sort();
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.name.toLowerCase().includes(q);

      const matchesRole = roleFilter === 'ALL' || u.role.name === roleFilter;
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && u.isActive) ||
        (statusFilter === 'INACTIVE' && !u.isActive);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const activePage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedUsers: UserItem[] = useMemo(() => {
    const start = (activePage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, activePage, pageSize]);

  const getRoleBadgeVariant = (roleName: string) => {
    switch (roleName) {
      case 'OWNER':
        return 'default';
      case 'MANAGER':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search user name or email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 h-9 text-sm"
            />
          </div>

          <Select
            value={roleFilter}
            onValueChange={(val) => {
              if (val) {
                setRoleFilter(val);
                setCurrentPage(1);
              }
            }}
          >
            <SelectTrigger className="w-full sm:w-36 h-9 text-xs">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Roles</SelectItem>
              {availableRoles.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(val) => {
              if (val) {
                setStatusFilter(val as 'ALL' | 'ACTIVE' | 'INACTIVE');
                setCurrentPage(1);
              }
            }}
          >
            <SelectTrigger className="w-full sm:w-32 h-9 text-xs">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>

          {(search || roleFilter !== 'ALL' || statusFilter !== 'ALL') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setRoleFilter('ALL');
                setStatusFilter('ALL');
                setCurrentPage(1);
              }}
              className="h-9 text-xs"
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden rounded-md border border-border sm:block overflow-hidden">
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
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No users found matching your filters.
                </TableCell>
              </TableRow>
            ) : (
              paginatedUsers.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {u.email}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(u.role?.name || '')}>
                      {u.role?.name || '—'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.isActive ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
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

      {/* Mobile Cards View */}
      <div className="space-y-3 sm:hidden">
        {filteredUsers.length === 0 ? (
          <Card className="p-6 text-center text-xs text-muted-foreground">
            No users found matching your filters.
          </Card>
        ) : (
          paginatedUsers.map((u) => (
            <Card key={u.id} className="p-4 shadow-xs space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-sm">{u.name}</div>
                  <div className="text-xs font-mono text-muted-foreground">{u.email}</div>
                </div>
                <Badge variant={getRoleBadgeVariant(u.role?.name || '')}>
                  {u.role?.name || '—'}
                </Badge>
              </div>
              <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
                <span>{new Date(u.createdAt).toLocaleDateString()}</span>
                {u.isActive ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="size-3.5" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-destructive font-medium">
                    <UserX className="size-3.5" />
                    Inactive
                  </span>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      <DataTablePagination
        currentPage={activePage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={filteredUsers.length}
        onPageChange={setCurrentPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setCurrentPage(1);
        }}
        itemLabel="users"
      />
    </div>
  );
}
