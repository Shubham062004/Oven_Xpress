'use client';

import { useState, useCallback, useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  Power,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Branch } from '@prisma/client';

import { useAuth } from '@/providers/auth-provider';
import { hasPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getBranches, type BranchStats } from '@/lib/branches/actions';

import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { Button } from '@/components/ui/button';
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

import { BranchFormDialog } from '@/components/branches/branch-form-dialog';
import { BranchStatusDialog } from '@/components/branches/branch-status-dialog';

// ─── Props ──────────────────────────────────────────────────────────────────

interface BranchListClientProps {
  initialBranches: Branch[];
  initialStats: BranchStats;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function BranchListClient({
  initialBranches,
  initialStats,
}: BranchListClientProps) {
  const router = useRouter();
  const user = useAuth();
  const [isPending, startTransition] = useTransition();

  // Data state
  const [branches, setBranches] = useState<Branch[]>(initialBranches);
  const [stats, setStats] = useState<BranchStats>(initialStats);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

  // Permission checks
  const canCreate = hasPermission(user, PERMISSIONS.BRANCH_CREATE);
  const canUpdate = hasPermission(user, PERMISSIONS.BRANCH_UPDATE);
  const canDeactivate = hasPermission(user, PERMISSIONS.BRANCH_DEACTIVATE);

  // ─── Data Fetching ──────────────────────────────────────────────────────

  const fetchBranches = useCallback(
    (search?: string, status?: string) => {
      startTransition(async () => {
        const result = await getBranches({
          search: search || undefined,
          status: (status === 'ALL' ? undefined : status) as 'ACTIVE' | 'INACTIVE' | undefined,
        });
        if (result.success && result.data) {
          setBranches(result.data);
          // Update stats from filtered data is not ideal; recompute from all data
          const total = result.data.length;
          const active = result.data.filter((b) => b.status === 'ACTIVE').length;
          // Only update stats if no filters are applied
          if (!search && (!status || status === 'ALL')) {
            setStats({ total, active, inactive: total - active });
          }
        } else {
          toast.error(result.error ?? 'Failed to load branches');
        }
      });
    },
    []
  );

  const refreshData = useCallback(() => {
    fetchBranches(searchQuery, statusFilter);
    // Also refresh stats independently
    startTransition(async () => {
      const { getBranchStats } = await import('@/lib/branches/actions');
      const statsResult = await getBranchStats();
      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data);
      }
    });
  }, [fetchBranches, searchQuery, statusFilter]);

  // ─── Search Debounce ────────────────────────────────────────────────────

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchBranches(value, statusFilter);
    }, 300);
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ─── Status Filter ──────────────────────────────────────────────────────

  const handleStatusFilter = (value: string | null) => {
    const val = value ?? 'ALL';
    setStatusFilter(val);
    fetchBranches(searchQuery, val);
  };

  // ─── Actions ────────────────────────────────────────────────────────────

  const handleEdit = (branch: Branch) => {
    setSelectedBranch(branch);
    setEditDialogOpen(true);
  };

  const handleStatusToggle = (branch: Branch) => {
    setSelectedBranch(branch);
    setStatusDialogOpen(true);
  };

  const handleView = (branch: Branch) => {
    router.push(`/branches/${branch.id}`);
  };

  const handleFormSuccess = () => {
    setCreateDialogOpen(false);
    setEditDialogOpen(false);
    setSelectedBranch(null);
    refreshData();
  };

  const handleStatusSuccess = () => {
    setStatusDialogOpen(false);
    setSelectedBranch(null);
    refreshData();
  };

  // ─── Helpers ────────────────────────────────────────────────────────────

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (time: string | null) => {
    if (!time) return '—';
    return time;
  };

  const getLocationString = (branch: Branch) => {
    const parts = [branch.city];
    if (branch.state) parts.push(branch.state);
    return parts.join(', ');
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Branches"
        description="Manage restaurant locations and branch information."
      >
        {canCreate && (
          <Button
            id="add-branch-button"
            onClick={() => setCreateDialogOpen(true)}
          >
            <Plus data-icon="inline-start" />
            Add Branch
          </Button>
        )}
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Branches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-success" />
              <p className="text-2xl font-semibold">{stats.active}</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Inactive
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <XCircle className="size-4 text-muted-foreground" />
              <p className="text-2xl font-semibold">{stats.inactive}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="branch-search"
            placeholder="Search branches by name, code, or city..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={handleStatusFilter}>
          <SelectTrigger id="status-filter" className="w-full sm:w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Loading State */}
      {isPending && branches.length === 0 && (
        <TableSkeleton rows={5} columns={6} />
      )}

      {/* Empty State */}
      {!isPending && branches.length === 0 && (
        <EmptyState
          icon={Building2}
          title={searchQuery || statusFilter !== 'ALL' ? 'No branches found' : 'No branches yet'}
          description={
            searchQuery || statusFilter !== 'ALL'
              ? 'Try adjusting your search or filter criteria.'
              : 'Get started by adding your first restaurant branch.'
          }
          action={
            canCreate && !searchQuery && statusFilter === 'ALL'
              ? {
                  label: 'Add your first branch',
                  onClick: () => setCreateDialogOpen(true),
                }
              : undefined
          }
        />
      )}

      {/* Branch Table */}
      {branches.length > 0 && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Branch</TableHead>
                <TableHead>Code</TableHead>
                <TableHead className="hidden md:table-cell">Location</TableHead>
                <TableHead className="hidden lg:table-cell">Contact</TableHead>
                <TableHead className="hidden xl:table-cell">Hours</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Created</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.map((branch) => (
                <TableRow key={branch.id}>
                  <TableCell className="font-medium">
                    {branch.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {branch.code}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {getLocationString(branch)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {branch.phone || branch.email || '—'}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    {branch.openingTime && branch.closingTime
                      ? `${formatTime(branch.openingTime)} – ${formatTime(branch.closingTime)}`
                      : '—'}
                  </TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {formatDate(branch.createdAt)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Actions for ${branch.name}`}
                          />
                        }
                      >
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" sideOffset={4}>
                        <DropdownMenuItem onClick={() => handleView(branch)}>
                          <Eye className="size-4" />
                          View Details
                        </DropdownMenuItem>
                        {canUpdate && (
                          <DropdownMenuItem onClick={() => handleEdit(branch)}>
                            <Pencil className="size-4" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        {canDeactivate && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant={branch.status === 'ACTIVE' ? 'destructive' : 'default'}
                              onClick={() => handleStatusToggle(branch)}
                            >
                              <Power className="size-4" />
                              {branch.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
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
      )}

      {/* Create Dialog */}
      <BranchFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleFormSuccess}
      />

      {/* Edit Dialog */}
      {selectedBranch && editDialogOpen && (
        <BranchFormDialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setSelectedBranch(null);
          }}
          branch={selectedBranch}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* Status Toggle Dialog */}
      {selectedBranch && statusDialogOpen && (
        <BranchStatusDialog
          open={statusDialogOpen}
          onOpenChange={(open) => {
            setStatusDialogOpen(open);
            if (!open) setSelectedBranch(null);
          }}
          branch={selectedBranch}
          onSuccess={handleStatusSuccess}
        />
      )}
    </div>
  );
}
