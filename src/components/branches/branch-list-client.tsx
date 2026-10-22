'use client';

import { useState, useCallback, useEffect, useRef, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Plus,
  Search,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/providers/auth-provider';
import { hasPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import {
  getBranches,
  type BranchStats,
  type BranchWithManager,
} from '@/lib/branches/actions';

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { BranchFormDialog } from '@/components/branches/branch-form-dialog';
import { BranchDeleteDialog } from '@/components/branches/branch-delete-dialog';
import { BranchEmployeesDialog } from '@/components/branches/branch-employees-dialog';
import { DataTablePagination } from '@/components/ui/data-table-pagination';

// ─── Props ──────────────────────────────────────────────────────────────────

interface BranchListClientProps {
  initialBranches: BranchWithManager[];
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
  const [branches, setBranches] = useState<BranchWithManager[]>(initialBranches);
  const [stats, setStats] = useState<BranchStats>(initialStats);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [employeesDialogOpen, setEmployeesDialogOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<BranchWithManager | null>(null);
  const [employeesBranch, setEmployeesBranch] = useState<BranchWithManager | null>(null);

  const handleViewEmployees = (b: BranchWithManager) => {
    setEmployeesBranch(b);
    setEmployeesDialogOpen(true);
  };

  // Permission checks
  const canCreate = hasPermission(user, PERMISSIONS.BRANCH_CREATE);

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
    setCurrentPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchBranches(value, statusFilter);
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ─── Status Filter ──────────────────────────────────────────────────────

  const handleStatusFilter = (value: string | null) => {
    const val = value ?? 'ALL';
    setStatusFilter(val);
    setCurrentPage(1);
    fetchBranches(searchQuery, val);
  };

  // ─── Actions ────────────────────────────────────────────────────────────

  const handleEdit = (branch: BranchWithManager) => {
    setSelectedBranch(branch);
    setEditDialogOpen(true);
  };

  const handleDelete = (branch: BranchWithManager) => {
    setSelectedBranch(branch);
    setDeleteDialogOpen(true);
  };

  const handleView = (branch: BranchWithManager) => {
    router.push(`/branches/${branch.id}`);
  };

  const handleFormSuccess = (updatedBranch?: BranchWithManager) => {
    setCreateDialogOpen(false);
    setEditDialogOpen(false);
    setSelectedBranch(null);

    if (updatedBranch) {
      setBranches((prev) => {
        const index = prev.findIndex((b) => b.id === updatedBranch.id);
        if (index >= 0) {
          const next = [...prev];
          next[index] = updatedBranch;
          return next;
        }
        return [updatedBranch, ...prev];
      });
    }

    refreshData();
  };

  const handleDeleteSuccess = (deletedId: string, updatedBranch?: BranchWithManager) => {
    setDeleteDialogOpen(false);
    setSelectedBranch(null);

    setBranches((prev) => {
      if (updatedBranch) {
        // Safe deactivation updated the branch
        return prev.map((b) => (b.id === deletedId ? updatedBranch : b));
      }
      // Hard delete removed the branch
      return prev.filter((b) => b.id !== deletedId);
    });

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

  const getLocationString = (branch: BranchWithManager) => {
    const parts = [branch.city];
    if (branch.state) parts.push(branch.state);
    return parts.join(', ');
  };

  // ─── Pagination Calculations ────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(branches.length / pageSize));
  const activePage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedBranches: BranchWithManager[] = useMemo(() => {
    const start = (activePage - 1) * pageSize;
    return branches.slice(start, start + pageSize);
  }, [branches, activePage, pageSize]);

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <TooltipProvider>
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
        <div className="grid gap-3 sm:gap-4 grid-cols-3">
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
          <TableSkeleton rows={5} columns={7} />
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

        {/* Branch List */}
        {branches.length > 0 && (
          <>
            {/* Mobile Card List */}
            <div className="sm:hidden space-y-3">
              {paginatedBranches.map((branch) => (
                <Card key={branch.id} className="border-border/60 shadow-xs">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => handleView(branch)}
                          className="font-semibold text-sm text-primary hover:underline text-left truncate block w-full"
                        >
                          {branch.name}
                        </button>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="font-mono text-xs shrink-0">
                            {branch.code}
                          </Badge>
                          <span className="text-xs text-muted-foreground truncate">
                            {getLocationString(branch)}
                          </span>
                        </div>
                      </div>
                      <Badge
                        variant={branch.status === 'ACTIVE' ? 'default' : 'secondary'}
                        className={
                          branch.status === 'ACTIVE'
                            ? 'bg-success/10 text-success shrink-0'
                            : 'bg-muted text-muted-foreground shrink-0'
                        }
                      >
                        {branch.status === 'ACTIVE' ? (
                          <CheckCircle2 className="mr-1 size-3" />
                        ) : (
                          <XCircle className="mr-1 size-3" />
                        )}
                        {branch.status}
                      </Badge>
                    </div>

                    {/* Branch Manager */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="text-muted-foreground/70">Manager:</span>
                      {branch.manager?.name ? (
                        <span className="font-medium text-foreground">{branch.manager.name}</span>
                      ) : (
                        <span className="italic text-muted-foreground/60">Unassigned</span>
                      )}
                    </div>

                    {/* Mobile Actions: View Staff, Edit, Delete */}
                    <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewEmployees(branch)}
                        className="min-h-11 h-auto flex-1 text-xs gap-1.5 text-primary border-primary/30 hover:bg-primary/10"
                        aria-label="View branch staff"
                        title="View branch staff and assign work"
                      >
                        <Eye className="size-3.5" />
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(branch)}
                        className="min-h-11 h-auto flex-1 text-xs gap-1.5"
                        aria-label="Edit branch"
                        title="Edit branch"
                      >
                        <Pencil className="size-3.5" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(branch)}
                        className="min-h-11 h-auto flex-1 text-xs gap-1.5 text-muted-foreground hover:text-destructive"
                        aria-label="Delete branch"
                        title="Delete branch"
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Desktop/Tablet Table */}
            <div className="hidden sm:block rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Branch</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead className="hidden md:table-cell">Location</TableHead>
                    <TableHead className="hidden lg:table-cell">Branch Manager</TableHead>
                    <TableHead className="hidden xl:table-cell">Hours</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Created</TableHead>
                    <TableHead className="text-right w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedBranches.map((branch) => (
                    <TableRow key={branch.id}>
                      <TableCell className="font-medium">
                        <button
                          type="button"
                          onClick={() => handleView(branch)}
                          className="hover:underline text-left cursor-pointer transition-colors"
                        >
                          {branch.name}
                        </button>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {branch.code}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {getLocationString(branch)}
                      </TableCell>
                      {/* Branch Manager Column */}
                      <TableCell className="hidden lg:table-cell">
                        {branch.manager?.name ? (
                          <span className="font-medium text-foreground">
                            {branch.manager.name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60 italic text-xs">
                            Unassigned
                          </span>
                        )}
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
                      {/* Actions Column: View Staff, Edit, Delete */}
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => handleViewEmployees(branch)}
                                  aria-label="View branch staff today"
                                  title="View branch staff and assign work"
                                  id={`view-branch-${branch.code}`}
                                  className="text-primary hover:text-primary hover:bg-primary/10"
                                >
                                  <Eye className="size-4" />
                                </Button>
                              }
                            />
                            <TooltipContent>View branch staff and assign work</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => handleEdit(branch)}
                                  aria-label="Edit branch"
                                  title="Edit branch"
                                  id={`edit-branch-${branch.code}`}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                              }
                            />
                            <TooltipContent>Edit branch</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => handleDelete(branch)}
                                  aria-label="Delete branch"
                                  title="Delete branch"
                                  id={`delete-branch-${branch.code}`}
                                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              }
                            />
                            <TooltipContent>Delete branch</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            <DataTablePagination
              currentPage={activePage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={branches.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
              itemLabel="branches"
            />
          </>
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

        {/* Delete Confirmation Dialog */}
        {selectedBranch && deleteDialogOpen && (
          <BranchDeleteDialog
            open={deleteDialogOpen}
            onOpenChange={(open) => {
              setDeleteDialogOpen(open);
              if (!open) setSelectedBranch(null);
            }}
            branch={selectedBranch}
            onSuccess={handleDeleteSuccess}
          />
        )}

        {/* Branch Staff and Work Management Dialog */}
        {employeesBranch && (
          <BranchEmployeesDialog
            open={employeesDialogOpen}
            onOpenChange={(open) => {
              setEmployeesDialogOpen(open);
              if (!open) setEmployeesBranch(null);
            }}
            branch={employeesBranch}
            onSuccess={refreshData}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
