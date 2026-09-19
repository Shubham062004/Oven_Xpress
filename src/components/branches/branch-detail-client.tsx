'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Clock,
  MapPin,
  Pencil,
  Phone,
  Power,
  CheckCircle2,
  XCircle,
  Package,
  Users,
  ShoppingCart,
  BarChart3,
} from 'lucide-react';
import type { Branch } from '@prisma/client';

import { useAuth } from '@/providers/auth-provider';
import { hasPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';

import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

import { BranchFormDialog } from '@/components/branches/branch-form-dialog';
import { BranchStatusDialog } from '@/components/branches/branch-status-dialog';

// ─── Props ──────────────────────────────────────────────────────────────────

interface BranchDetailClientProps {
  branch: Branch;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function BranchDetailClient({ branch: initialBranch }: BranchDetailClientProps) {
  const router = useRouter();
  const user = useAuth();

  const [branch] = useState(initialBranch);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);

  const canUpdate = hasPermission(user, PERMISSIONS.BRANCH_UPDATE);
  const canDeactivate = hasPermission(user, PERMISSIONS.BRANCH_DEACTIVATE);

  const handleFormSuccess = () => {
    setEditDialogOpen(false);
    // Refresh via router to get updated data from server
    router.refresh();
  };

  const handleStatusSuccess = () => {
    setStatusDialogOpen(false);
    router.refresh();
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/branches')}
          className="gap-1.5"
        >
          <ArrowLeft className="size-4" />
          Back to Branches
        </Button>

        <PageHeader title={branch.name}>
          <Badge
            variant={branch.status === 'ACTIVE' ? 'default' : 'secondary'}
            className={
              branch.status === 'ACTIVE'
                ? 'bg-success/10 text-success'
                : 'bg-muted text-muted-foreground'
            }
          >
            {branch.status === 'ACTIVE' ? (
              <CheckCircle2 className="mr-1 size-3" />
            ) : (
              <XCircle className="mr-1 size-3" />
            )}
            {branch.status}
          </Badge>
          {canUpdate && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditDialogOpen(true)}
            >
              <Pencil data-icon="inline-start" className="size-3.5" />
              Edit
            </Button>
          )}
          {canDeactivate && (
            <Button
              variant={branch.status === 'ACTIVE' ? 'destructive' : 'default'}
              size="sm"
              onClick={() => setStatusDialogOpen(true)}
            >
              <Power data-icon="inline-start" className="size-3.5" />
              {branch.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
            </Button>
          )}
        </PageHeader>
      </div>

      {/* Detail Cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Building2 className="size-4 text-muted-foreground" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow label="Branch Name" value={branch.name} />
            <DetailRow
              label="Branch Code"
              value={
                <Badge variant="outline" className="font-mono text-xs">
                  {branch.code}
                </Badge>
              }
            />
            <DetailRow
              label="Description"
              value={branch.description || '—'}
            />
          </CardContent>
        </Card>

        {/* Location */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <MapPin className="size-4 text-muted-foreground" />
              Location
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow label="Address" value={branch.address} />
            <DetailRow label="City" value={branch.city} />
            <DetailRow label="State" value={branch.state || '—'} />
            <DetailRow label="Postal Code" value={branch.postalCode || '—'} />
          </CardContent>
        </Card>

        {/* Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Phone className="size-4 text-muted-foreground" />
              Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow
              label="Phone"
              value={
                branch.phone ? (
                  <a href={`tel:${branch.phone}`} className="text-primary hover:underline">
                    {branch.phone}
                  </a>
                ) : '—'
              }
            />
            <DetailRow
              label="Email"
              value={
                branch.email ? (
                  <a href={`mailto:${branch.email}`} className="text-primary hover:underline">
                    {branch.email}
                  </a>
                ) : '—'
              }
            />
          </CardContent>
        </Card>

        {/* Operating Hours */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="size-4 text-muted-foreground" />
              Operating Hours
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow
              label="Opening Time"
              value={branch.openingTime || '—'}
            />
            <DetailRow
              label="Closing Time"
              value={branch.closingTime || '—'}
            />
          </CardContent>
        </Card>
      </div>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Metadata</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailRow
              label="Created"
              value={formatDate(branch.createdAt)}
            />
            <DetailRow
              label="Last Updated"
              value={formatDate(branch.updatedAt)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Future Module Placeholders */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Branch Operations</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FutureModuleCard icon={Users} title="Employees" />
          <FutureModuleCard icon={ShoppingCart} title="Orders" />
          <FutureModuleCard icon={Package} title="Inventory" />
          <FutureModuleCard icon={BarChart3} title="Analytics" />
        </div>
      </div>

      {/* Edit Dialog */}
      {editDialogOpen && (
        <BranchFormDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          branch={branch}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* Status Dialog */}
      {statusDialogOpen && (
        <BranchStatusDialog
          open={statusDialogOpen}
          onOpenChange={setStatusDialogOpen}
          branch={branch}
          onSuccess={handleStatusSuccess}
        />
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}

function FutureModuleCard({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <Card size="sm">
      <CardContent className="pt-4">
        <EmptyState
          icon={Icon}
          title={title}
          description="Coming in a future module"
          className="py-4"
        />
      </CardContent>
    </Card>
  );
}
