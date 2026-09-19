'use client';

import { useState, useTransition, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Plus,
  MoreHorizontal,
  Eye,
  Pencil,
  Power,
  CheckCircle2,
  XCircle,
  Building2,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  getEmployees,
  getEmployeeStats,
  type EmployeeItem,
  type EmployeeStats,
  type BranchOption,
} from '@/lib/employees/actions';
import { useAuth } from '@/providers/auth-provider';
import { hasPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';

import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/loading-skeleton';

import { EmployeeFormDialog } from '@/components/employees/employee-form-dialog';
import { EmployeeStatusDialog } from '@/components/employees/employee-status-dialog';

// ─── Props ──────────────────────────────────────────────────────────────────

interface EmployeeListClientProps {
  initialEmployees: EmployeeItem[];
  initialStats: EmployeeStats;
  branches: BranchOption[];
  designations: string[];
}

// ─── Component ──────────────────────────────────────────────────────────────

export function EmployeeListClient({
  initialEmployees,
  initialStats,
  branches,
  designations,
}: EmployeeListClientProps) {
  const router = useRouter();
  const user = useAuth();
  const [isPending, startTransition] = useTransition();

  // Data state
  const [employees, setEmployees] = useState<EmployeeItem[]>(initialEmployees);
  const [stats, setStats] = useState<EmployeeStats>(initialStats);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [designationFilter, setDesignationFilter] = useState<string>('ALL');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeItem | null>(null);

  // Permission checks
  const canCreate = hasPermission(user, PERMISSIONS.EMPLOYEE_CREATE);
  const canUpdate = hasPermission(user, PERMISSIONS.EMPLOYEE_UPDATE);
  const canDeactivate = hasPermission(user, PERMISSIONS.EMPLOYEE_DEACTIVATE);

  // ─── Data Fetching ──────────────────────────────────────────────────────

  const fetchEmployees = useCallback(
    (search?: string, branch?: string, status?: string, desig?: string) => {
      startTransition(async () => {
        const result = await getEmployees({
          search: search || undefined,
          branchId: branch === 'ALL' ? undefined : branch,
          status: (status === 'ALL' ? undefined : status) as 'ACTIVE' | 'INACTIVE' | undefined,
          designation: desig === 'ALL' ? undefined : desig,
        });

        if (result.success && result.data) {
          setEmployees(result.data);
        } else {
          toast.error(result.error ?? 'Failed to load employees');
        }
      });
    },
    []
  );

  const refreshData = useCallback(() => {
    fetchEmployees(searchQuery, branchFilter, statusFilter, designationFilter);
    // Refresh stats
    startTransition(async () => {
      const statsResult = await getEmployeeStats();
      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data);
      }
    });
  }, [fetchEmployees, searchQuery, branchFilter, statusFilter, designationFilter]);

  // ─── Search Debounce ────────────────────────────────────────────────────

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchEmployees(value, branchFilter, statusFilter, designationFilter);
    }, 300);
  };

  const handleBranchFilter = (value: string | null) => {
    const val = value ?? 'ALL';
    setBranchFilter(val);
    fetchEmployees(searchQuery, val, statusFilter, designationFilter);
  };

  const handleStatusFilter = (value: string | null) => {
    const val = value ?? 'ALL';
    setStatusFilter(val);
    fetchEmployees(searchQuery, branchFilter, val, designationFilter);
  };

  const handleDesignationFilter = (value: string | null) => {
    const val = value ?? 'ALL';
    setDesignationFilter(val);
    fetchEmployees(searchQuery, branchFilter, statusFilter, val);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setBranchFilter('ALL');
    setStatusFilter('ALL');
    setDesignationFilter('ALL');
    fetchEmployees('', 'ALL', 'ALL', 'ALL');
  };

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    branchFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    designationFilter !== 'ALL';

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ─── Actions ────────────────────────────────────────────────────────────

  const handleEdit = (emp: EmployeeItem) => {
    setSelectedEmployee(emp);
    setEditDialogOpen(true);
  };

  const handleStatusToggle = (emp: EmployeeItem) => {
    setSelectedEmployee(emp);
    setStatusDialogOpen(true);
  };

  const handleView = (emp: EmployeeItem) => {
    router.push(`/employees/${emp.id}`);
  };

  const handleFormSuccess = () => {
    setCreateDialogOpen(false);
    setEditDialogOpen(false);
    setSelectedEmployee(null);
    refreshData();
  };

  const handleStatusSuccess = () => {
    setStatusDialogOpen(false);
    setSelectedEmployee(null);
    refreshData();
  };

  // ─── Formatters ─────────────────────────────────────────────────────────

  const formatCurrency = (amount: number, type: string) => {
    const formatted = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);

    switch (type) {
      case 'MONTHLY':
        return `${formatted} / mo`;
      case 'DAILY':
        return `${formatted} / day`;
      case 'HOURLY':
        return `${formatted} / hr`;
      default:
        return formatted;
    }
  };

  const formatDate = (date: Date | string) => {
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(date));
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
  };

  const branchCount = Object.keys(stats.branchCounts || {}).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Employees"
        description="Manage staff across restaurant branches."
      >
        {canCreate && (
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-1.5 size-4" />
            Add Employee
          </Button>
        )}
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Staff
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Employees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-green-600" />
              <p className="text-2xl font-semibold">{stats.active}</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Inactive Staff
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <XCircle className="size-4 text-muted-foreground" />
              <p className="text-2xl font-semibold">{stats.inactive}</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Branches with Staff
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              <p className="text-2xl font-semibold">{branchCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="employee-search"
            placeholder="Search by name, employee code, phone, or email..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          {/* Branch Filter */}
          <Select value={branchFilter} onValueChange={handleBranchFilter}>
            <SelectTrigger id="branch-filter" className="w-full sm:w-44">
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Branches</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={handleStatusFilter}>
            <SelectTrigger id="status-filter" className="w-full sm:w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>

          {/* Designation Filter */}
          {designations.length > 0 && (
            <Select value={designationFilter} onValueChange={handleDesignationFilter}>
              <SelectTrigger id="designation-filter" className="w-full sm:w-40">
                <SelectValue placeholder="Designation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Designations</SelectItem>
                {designations.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {isPending && employees.length === 0 && (
        <TableSkeleton rows={5} columns={7} />
      )}

      {/* Empty State */}
      {!isPending && employees.length === 0 && (
        <EmptyState
          icon={Users}
          title={hasActiveFilters ? 'No matching employees' : 'No employees yet'}
          description={
            hasActiveFilters
              ? 'Try adjusting your search criteria or clearing active filters.'
              : 'Add staff members to assign them to branches and track compensation.'
          }
          action={
            hasActiveFilters
              ? { label: 'Clear Filters', onClick: clearFilters }
              : canCreate
                ? { label: 'Add Employee', onClick: () => setCreateDialogOpen(true) }
                : undefined
          }
        />
      )}

      {/* Desktop / Tablet Data Table */}
      {employees.length > 0 && (
        <div className="hidden rounded-lg border md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead className="hidden lg:table-cell">Joining Date</TableHead>
                <TableHead>Salary</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((emp) => (
                <TableRow key={emp.id}>
                  {/* Employee Name & Contact */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {getInitials(emp.firstName, emp.lastName)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 font-medium">
                          <span>{emp.firstName} {emp.lastName}</span>
                          {emp.user && (
                            <span title="Linked to application user account">
                              <Badge variant="outline" className="px-1 py-0 text-[10px] font-normal text-muted-foreground">
                                Account
                              </Badge>
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {emp.email || emp.phone}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  {/* Code */}
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {emp.employeeCode}
                    </Badge>
                  </TableCell>

                  {/* Designation */}
                  <TableCell>
                    <span className="text-sm font-medium">{emp.designation}</span>
                  </TableCell>

                  {/* Branch */}
                  <TableCell>
                    <div>
                      <div className="text-sm font-medium">{emp.branch.name}</div>
                      <div className="text-xs text-muted-foreground">{emp.branch.city}</div>
                    </div>
                  </TableCell>

                  {/* Joining Date */}
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {formatDate(emp.joiningDate)}
                  </TableCell>

                  {/* Salary */}
                  <TableCell>
                    <div className="text-sm font-medium">
                      {formatCurrency(emp.salary, emp.salaryType)}
                    </div>
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <Badge
                      variant={emp.employmentStatus === 'ACTIVE' ? 'default' : 'secondary'}
                      className={
                        emp.employmentStatus === 'ACTIVE'
                          ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                          : 'bg-muted text-muted-foreground'
                      }
                    >
                      {emp.employmentStatus === 'ACTIVE' ? (
                        <CheckCircle2 className="mr-1 size-3" />
                      ) : (
                        <XCircle className="mr-1 size-3" />
                      )}
                      {emp.employmentStatus}
                    </Badge>
                  </TableCell>

                  {/* Actions Dropdown */}
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Actions for ${emp.firstName} ${emp.lastName}`}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleView(emp)}>
                          <Eye className="mr-2 size-4" />
                          View Details
                        </DropdownMenuItem>

                        {canUpdate && (
                          <DropdownMenuItem onClick={() => handleEdit(emp)}>
                            <Pencil className="mr-2 size-4" />
                            Edit Employee
                          </DropdownMenuItem>
                        )}

                        {canDeactivate && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleStatusToggle(emp)}
                              className={
                                emp.employmentStatus === 'ACTIVE'
                                  ? 'text-destructive focus:text-destructive'
                                  : 'text-green-600 focus:text-green-600'
                              }
                            >
                              <Power className="mr-2 size-4" />
                              {emp.employmentStatus === 'ACTIVE'
                                ? 'Deactivate Employee'
                                : 'Reactivate Employee'}
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

      {/* Mobile Cards Layout */}
      {employees.length > 0 && (
        <div className="grid gap-3 md:hidden">
          {employees.map((emp) => (
            <Card key={emp.id} size="sm" className="relative">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {getInitials(emp.firstName, emp.lastName)}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">
                        {emp.firstName} {emp.lastName}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="outline" className="font-mono text-[10px] px-1 py-0">
                          {emp.employeeCode}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{emp.designation}</span>
                      </div>
                    </div>
                  </div>

                  <Badge
                    variant={emp.employmentStatus === 'ACTIVE' ? 'default' : 'secondary'}
                    className={
                      emp.employmentStatus === 'ACTIVE'
                        ? 'bg-green-500/10 text-green-700 dark:text-green-400 text-xs'
                        : 'bg-muted text-muted-foreground text-xs'
                    }
                  >
                    {emp.employmentStatus}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground border-t pt-2">
                  <div>
                    <span className="block font-medium text-foreground">Branch</span>
                    <span>{emp.branch.name}</span>
                  </div>
                  <div>
                    <span className="block font-medium text-foreground">Compensation</span>
                    <span>{formatCurrency(emp.salary, emp.salaryType)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t pt-2">
                  <span className="text-xs text-muted-foreground">
                    Joined {formatDate(emp.joiningDate)}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => handleView(emp)}>
                      <Eye className="mr-1 size-3.5" />
                      View
                    </Button>
                    {canUpdate && (
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(emp)}>
                        <Pencil className="size-3.5" />
                      </Button>
                    )}
                    {canDeactivate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStatusToggle(emp)}
                        className={
                          emp.employmentStatus === 'ACTIVE'
                            ? 'text-destructive'
                            : 'text-green-600'
                        }
                      >
                        <Power className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <EmployeeFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        branches={branches}
        onSuccess={handleFormSuccess}
      />

      {/* Edit Dialog */}
      {selectedEmployee && (
        <EmployeeFormDialog
          key={selectedEmployee.id}
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setSelectedEmployee(null);
          }}
          branches={branches}
          employee={selectedEmployee}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* Status Confirmation Dialog */}
      {selectedEmployee && (
        <EmployeeStatusDialog
          open={statusDialogOpen}
          onOpenChange={(open) => {
            setStatusDialogOpen(open);
            if (!open) setSelectedEmployee(null);
          }}
          employee={selectedEmployee}
          onSuccess={handleStatusSuccess}
        />
      )}
    </div>
  );
}
