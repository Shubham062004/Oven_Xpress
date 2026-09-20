'use client';

import { useState, useCallback, useEffect, useRef, useTransition } from 'react';
import Link from 'next/link';
import {
  Truck,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  Power,
  Phone,
  Mail,
  MapPin,
  ShoppingBag,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import { SupplierStatus } from '@prisma/client';

import { useAuth } from '@/providers/auth-provider';
import { hasPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getSuppliers, getSupplierStats } from '@/lib/suppliers/actions';
import type { SupplierListItem, SupplierStats } from '@/lib/suppliers/types';

import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { SupplierFormDialog } from '@/components/suppliers/supplier-form-dialog';
import { SupplierStatusDialog } from '@/components/suppliers/supplier-status-dialog';

interface SupplierListClientProps {
  initialSuppliers: SupplierListItem[];
  initialStats: SupplierStats;
}

export function SupplierListClient({
  initialSuppliers,
  initialStats,
}: SupplierListClientProps) {
  const user = useAuth();
  const [isPending, startTransition] = useTransition();

  const [suppliers, setSuppliers] = useState<SupplierListItem[]>(initialSuppliers);
  const [stats, setStats] = useState<SupplierStats>(initialStats);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierListItem | null>(null);

  const canCreate = hasPermission(user, PERMISSIONS.SUPPLIER_CREATE);
  const canUpdate = hasPermission(user, PERMISSIONS.SUPPLIER_UPDATE);
  const canDeactivate = hasPermission(user, PERMISSIONS.SUPPLIER_DEACTIVATE);

  const fetchSuppliers = useCallback(
    (search?: string, status?: string) => {
      startTransition(async () => {
        const [suppliersRes, statsRes] = await Promise.all([
          getSuppliers({
            search: search || undefined,
            status: (status as 'ALL' | 'ACTIVE' | 'INACTIVE') || undefined,
          }),
          getSupplierStats(),
        ]);

        if (suppliersRes.success && suppliersRes.data) {
          setSuppliers(suppliersRes.data);
        } else if (suppliersRes.error) {
          toast.error(suppliersRes.error);
        }

        if (statsRes.success && statsRes.data) {
          setStats(statsRes.data);
        }
      });
    },
    []
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuppliers(value, statusFilter);
    }, 300);
  };

  const handleStatusChange = (val: string | null) => {
    const nextStatus = val ?? 'ALL';
    setStatusFilter(nextStatus);
    fetchSuppliers(searchQuery, nextStatus);
  };

  const handleOpenEdit = (sup: SupplierListItem) => {
    setSelectedSupplier(sup);
    setEditDialogOpen(true);
  };

  const handleOpenStatus = (sup: SupplierListItem) => {
    setSelectedSupplier(sup);
    setStatusDialogOpen(true);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Suppliers Directory"
        description="Manage master vendor profiles, contact details, and procurement history across all branches."
      >
        {canCreate && (
          <Button onClick={() => setCreateDialogOpen(true)} className="gap-2 shadow-sm">
            <Plus className="size-4" />
            Add Supplier
          </Button>
        )}
      </PageHeader>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Suppliers
            </CardTitle>
            <div className="p-2 rounded-md bg-primary/10 text-primary">
              <Truck className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSuppliers}</div>
            <p className="text-xs text-muted-foreground mt-1">Registered vendor partners</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Active Suppliers
            </CardTitle>
            <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Building2 className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.activeSuppliers}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Available for new purchases</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Inactive Suppliers
            </CardTitle>
            <div className="p-2 rounded-md bg-muted text-muted-foreground">
              <Power className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">
              {stats.inactiveSuppliers}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Suspended or archived</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Purchase Orders
            </CardTitle>
            <div className="p-2 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <ShoppingBag className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrdersCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Orders placed with suppliers</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search suppliers by name, contact, city, phone..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="pl-9 h-10"
          />
        </div>

        <div className="w-full sm:w-48">
          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Status: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="ACTIVE">Active Only</SelectItem>
              <SelectItem value="INACTIVE">Inactive Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table Section */}
      <Card className="border-border/60 shadow-xs overflow-hidden">
        {isPending ? (
          <div className="p-6">
            <TableSkeleton rows={5} columns={6} />
          </div>
        ) : suppliers.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Truck}
              title="No suppliers found"
              description={
                searchQuery || statusFilter !== 'ALL'
                  ? 'No suppliers match your active search or filter criteria.'
                  : 'Start by onboarding your first vendor to enable purchase orders.'
              }
              action={
                canCreate
                  ? {
                      label: 'Add Supplier',
                      onClick: () => setCreateDialogOpen(true),
                    }
                  : undefined
              }
            />
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Supplier Name</TableHead>
                    <TableHead className="font-semibold">Contact Person</TableHead>
                    <TableHead className="font-semibold">Contact Info</TableHead>
                    <TableHead className="font-semibold">Location</TableHead>
                    <TableHead className="font-semibold">Purchase History</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="text-right font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((sup) => (
                    <TableRow key={sup.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell>
                        <div className="font-medium text-foreground">
                          <Link
                            href={`/suppliers/${sup.id}`}
                            className="hover:underline hover:text-primary transition-colors flex items-center gap-1.5"
                          >
                            <Truck className="size-3.5 text-muted-foreground" />
                            {sup.name}
                          </Link>
                        </div>
                        {sup.notes && (
                          <div className="text-xs text-muted-foreground truncate max-w-xs mt-0.5">
                            {sup.notes}
                          </div>
                        )}
                      </TableCell>

                      <TableCell>
                        <span className="text-sm">
                          {sup.contactPerson || (
                            <span className="text-muted-foreground italic">—</span>
                          )}
                        </span>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-0.5 text-xs text-muted-foreground">
                          {sup.phone && (
                            <div className="flex items-center gap-1.5 text-foreground/80">
                              <Phone className="size-3 text-muted-foreground" />
                              {sup.phone}
                            </div>
                          )}
                          {sup.email && (
                            <div className="flex items-center gap-1.5">
                              <Mail className="size-3 text-muted-foreground" />
                              {sup.email}
                            </div>
                          )}
                          {!sup.phone && !sup.email && <span>—</span>}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="text-xs flex items-center gap-1.5 text-muted-foreground">
                          <MapPin className="size-3 shrink-0" />
                          <span>
                            {[sup.city, sup.state].filter(Boolean).join(', ') || '—'}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="text-sm font-medium">
                          {sup.totalOrders} {sup.totalOrders === 1 ? 'order' : 'orders'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ₹{sup.totalSpend.toLocaleString('en-IN', { minimumFractionDigits: 2 })} spend
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant={sup.status === SupplierStatus.ACTIVE ? 'default' : 'secondary'}
                          className={
                            sup.status === SupplierStatus.ACTIVE
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                              : 'bg-muted text-muted-foreground'
                          }
                        >
                          {sup.status === SupplierStatus.ACTIVE ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button variant="ghost" size="icon-sm" aria-label="Supplier actions">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem render={<Link href={`/suppliers/${sup.id}`} />}>
                              <Eye className="mr-2 size-4" />
                              View Details
                            </DropdownMenuItem>

                            {canUpdate && (
                              <DropdownMenuItem onClick={() => handleOpenEdit(sup)}>
                                <Pencil className="mr-2 size-4" />
                                Edit Details
                              </DropdownMenuItem>
                            )}

                            {canDeactivate && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleOpenStatus(sup)}
                                  className={
                                    sup.status === SupplierStatus.ACTIVE
                                      ? 'text-destructive focus:text-destructive'
                                      : 'text-emerald-600 focus:text-emerald-600'
                                  }
                                >
                                  <Power className="mr-2 size-4" />
                                  {sup.status === SupplierStatus.ACTIVE
                                    ? 'Deactivate'
                                    : 'Reactivate'}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-border/60">
              {suppliers.map((sup) => (
                <div key={sup.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link
                        href={`/suppliers/${sup.id}`}
                        className="font-medium text-base hover:text-primary transition-colors flex items-center gap-1.5"
                      >
                        <Truck className="size-4 text-muted-foreground" />
                        {sup.name}
                      </Link>
                      {sup.contactPerson && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Contact: {sup.contactPerson}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant={sup.status === SupplierStatus.ACTIVE ? 'default' : 'secondary'}
                      className={
                        sup.status === SupplierStatus.ACTIVE
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                          : 'bg-muted text-muted-foreground'
                      }
                    >
                      {sup.status === SupplierStatus.ACTIVE ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1">
                    {sup.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="size-3" />
                        {sup.phone}
                      </div>
                    )}
                    {sup.email && (
                      <div className="flex items-center gap-1.5">
                        <Mail className="size-3" />
                        {sup.email}
                      </div>
                    )}
                    {(sup.city || sup.state) && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="size-3" />
                        {[sup.city, sup.state].filter(Boolean).join(', ')}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs">
                    <div>
                      <span className="font-semibold text-foreground">{sup.totalOrders}</span> orders • ₹
                      {sup.totalSpend.toLocaleString('en-IN')} spend
                    </div>
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/suppliers/${sup.id}`}
                        className={buttonVariants({
                          variant: 'ghost',
                          size: 'sm',
                          className: 'h-8 px-2',
                        })}
                      >
                        Details
                      </Link>
                      {canUpdate && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => handleOpenEdit(sup)}
                        >
                          Edit
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Dialogs */}
      <SupplierFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => fetchSuppliers(searchQuery, statusFilter)}
      />

      <SupplierFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        supplier={selectedSupplier}
        onSuccess={() => fetchSuppliers(searchQuery, statusFilter)}
      />

      {selectedSupplier && (
        <SupplierStatusDialog
          open={statusDialogOpen}
          onOpenChange={setStatusDialogOpen}
          supplier={selectedSupplier}
          onSuccess={() => fetchSuppliers(searchQuery, statusFilter)}
        />
      )}
    </div>
  );
}
