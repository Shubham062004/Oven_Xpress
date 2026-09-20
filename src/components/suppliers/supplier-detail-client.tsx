'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Truck,
  ArrowLeft,
  Pencil,
  Power,
  Phone,
  Mail,
  MapPin,
  ShoppingBag,
  Plus,
  Calendar,
  Building2,
  ExternalLink,
} from 'lucide-react';
import { SupplierStatus, PurchaseOrderStatus } from '@prisma/client';

import { useAuth } from '@/providers/auth-provider';
import { hasPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import type { SupplierDetail } from '@/lib/suppliers/types';

import { PageHeader } from '@/components/ui/page-header';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
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
import { EmptyState } from '@/components/ui/empty-state';

import { SupplierFormDialog } from '@/components/suppliers/supplier-form-dialog';
import { SupplierStatusDialog } from '@/components/suppliers/supplier-status-dialog';

interface SupplierDetailClientProps {
  supplier: SupplierDetail;
}

export function SupplierDetailClient({ supplier }: SupplierDetailClientProps) {
  const router = useRouter();
  const user = useAuth();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);

  const canUpdate = hasPermission(user, PERMISSIONS.SUPPLIER_UPDATE);
  const canDeactivate = hasPermission(user, PERMISSIONS.SUPPLIER_DEACTIVATE);
  const canCreatePurchase = hasPermission(user, PERMISSIONS.PURCHASE_CREATE);

  const getStatusBadge = (status: PurchaseOrderStatus) => {
    switch (status) {
      case PurchaseOrderStatus.RECEIVED:
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
            Received
          </Badge>
        );
      case PurchaseOrderStatus.PARTIALLY_RECEIVED:
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
            Partially Received
          </Badge>
        );
      case PurchaseOrderStatus.ORDERED:
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30">
            Ordered
          </Badge>
        );
      case PurchaseOrderStatus.DRAFT:
        return <Badge variant="secondary">Draft</Badge>;
      case PurchaseOrderStatus.CANCELLED:
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleRefresh = () => {
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Back Link & Header */}
      <div className="space-y-2">
        <Link
          href="/suppliers"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to Suppliers Directory
        </Link>

        <PageHeader
          title={supplier.name}
          description={`Registered vendor profile • Master Catalog #${supplier.id.slice(-6)}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            {canCreatePurchase && supplier.status === SupplierStatus.ACTIVE && (
              <Link
                href={`/purchases/new?supplierId=${supplier.id}`}
                className={buttonVariants({ className: 'gap-2 shadow-sm' })}
              >
                <Plus className="size-4" />
                New Purchase Order
              </Link>
            )}

            {canUpdate && (
              <Button
                variant="outline"
                onClick={() => setEditDialogOpen(true)}
                className="gap-2"
              >
                <Pencil className="size-4" />
                Edit
              </Button>
            )}

            {canDeactivate && (
              <Button
                variant={supplier.status === SupplierStatus.ACTIVE ? 'outline' : 'default'}
                onClick={() => setStatusDialogOpen(true)}
                className={
                  supplier.status === SupplierStatus.ACTIVE
                    ? 'text-destructive hover:text-destructive'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }
              >
                <Power className="size-4 mr-1.5" />
                {supplier.status === SupplierStatus.ACTIVE ? 'Deactivate' : 'Reactivate'}
              </Button>
            )}
          </div>
        </PageHeader>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Purchase Amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              ₹{supplier.totalSpend.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Cumulative order volume</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Purchase Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{supplier.totalOrders}</div>
            <p className="text-xs text-muted-foreground mt-1">Lifetime orders placed</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Recent Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {supplier.recentPurchases.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Recorded in system</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Operational Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge
              variant={supplier.status === SupplierStatus.ACTIVE ? 'default' : 'secondary'}
              className={
                supplier.status === SupplierStatus.ACTIVE
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-sm py-0.5'
                  : 'bg-muted text-muted-foreground text-sm py-0.5'
              }
            >
              {supplier.status === SupplierStatus.ACTIVE ? 'Active Vendor' : 'Inactive'}
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">
              {supplier.status === SupplierStatus.ACTIVE
                ? 'Can receive new purchase orders'
                : 'Disabled for new procurement'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Info Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact & Address Card */}
        <Card className="border-border/60 shadow-xs lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="size-4 text-primary" />
              Vendor Contact Info
            </CardTitle>
            <CardDescription>Primary point of contact & delivery details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Contact Person
              </span>
              <p className="font-medium text-foreground">
                {supplier.contactPerson || <span className="text-muted-foreground italic">Not specified</span>}
              </p>
            </div>

            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Phone Number
              </span>
              {supplier.phone ? (
                <div className="flex items-center gap-2 text-foreground">
                  <Phone className="size-3.5 text-muted-foreground" />
                  <a href={`tel:${supplier.phone}`} className="hover:underline hover:text-primary">
                    {supplier.phone}
                  </a>
                </div>
              ) : (
                <span className="text-muted-foreground italic">Not provided</span>
              )}
            </div>

            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Email Address
              </span>
              {supplier.email ? (
                <div className="flex items-center gap-2 text-foreground">
                  <Mail className="size-3.5 text-muted-foreground" />
                  <a href={`mailto:${supplier.email}`} className="hover:underline hover:text-primary">
                    {supplier.email}
                  </a>
                </div>
              ) : (
                <span className="text-muted-foreground italic">Not provided</span>
              )}
            </div>

            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Physical Address
              </span>
              {supplier.address || supplier.city ? (
                <div className="flex items-start gap-2 text-foreground">
                  <MapPin className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    {supplier.address && <p>{supplier.address}</p>}
                    <p className="text-muted-foreground text-xs">
                      {[supplier.city, supplier.state, supplier.postalCode]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  </div>
                </div>
              ) : (
                <span className="text-muted-foreground italic">No address on file</span>
              )}
            </div>

            {supplier.notes && (
              <div className="pt-2 border-t border-border/60">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Operational Notes
                </span>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{supplier.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Purchase Orders Table Card */}
        <Card className="border-border/60 shadow-xs lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingBag className="size-4 text-primary" />
                Recent Purchase Orders
              </CardTitle>
              <CardDescription>All procurement orders placed with this supplier</CardDescription>
            </div>
            {canCreatePurchase && supplier.status === SupplierStatus.ACTIVE && (
              <Link
                href={`/purchases/new?supplierId=${supplier.id}`}
                className={buttonVariants({ variant: 'outline', size: 'sm', className: 'gap-1.5' })}
              >
                <Plus className="size-3.5" />
                Create PO
              </Link>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {supplier.recentPurchases.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={ShoppingBag}
                  title="No purchase orders yet"
                  description="No purchase orders have been created for this supplier yet."
                  action={
                    canCreatePurchase && supplier.status === SupplierStatus.ACTIVE
                      ? {
                          label: 'Create First Purchase Order',
                          onClick: () => router.push(`/purchases/new?supplierId=${supplier.id}`),
                        }
                      : undefined
                  }
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="font-semibold">Purchase #</TableHead>
                    <TableHead className="font-semibold">Branch</TableHead>
                    <TableHead className="font-semibold">Order Date</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="text-right font-semibold">Total (₹)</TableHead>
                    <TableHead className="text-right font-semibold">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplier.recentPurchases.map((po) => (
                    <TableRow key={po.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">
                        <Link
                          href={`/purchases/${po.id}`}
                          className="hover:underline hover:text-primary transition-colors flex items-center gap-1"
                        >
                          {po.purchaseNumber}
                          <ExternalLink className="size-3 text-muted-foreground" />
                        </Link>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs">
                          <Building2 className="size-3.5 text-muted-foreground" />
                          <span>{po.branchName}</span>
                        </div>
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="size-3 text-muted-foreground" />
                          {new Date(po.orderDate).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      </TableCell>

                      <TableCell>{getStatusBadge(po.status)}</TableCell>

                      <TableCell className="text-right font-medium">
                        ₹{po.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        <span className="text-xs text-muted-foreground block">
                          {po.itemsCount} {po.itemsCount === 1 ? 'item' : 'items'}
                        </span>
                      </TableCell>

                      <TableCell className="text-right">
                        <Link
                          href={`/purchases/${po.id}`}
                          className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'h-8 px-2' })}
                        >
                          View PO
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <SupplierFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        supplier={supplier}
        onSuccess={handleRefresh}
      />

      <SupplierStatusDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        supplier={supplier}
        onSuccess={handleRefresh}
      />
    </div>
  );
}
