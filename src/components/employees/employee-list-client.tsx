'use client';

import { useState, useTransition, useCallback, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Plus,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  Building2,
  Users,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
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
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { DataTablePagination } from '@/components/ui/data-table-pagination';

import { EmployeeFormDialog } from '@/components/employees/employee-form-dialog';
import { EmployeeDeleteDialog } from '@/components/employees/employee-delete-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ─── Types ──────────────────────────────────────────────────────────────────

type SortColumn =
  | 'employee'
  | 'code'
  | 'designation'
  | 'branch'
  | 'joiningDate'
  | 'salary'
  | 'status';

type SortDirection = 'asc' | 'desc';

interface EmployeeListClientProps {
  initialEmployees: EmployeeItem[];
  initialStats: EmployeeStats;
  branches: BranchOption[];
  designations?: string[];
}

// ─── Sort Indicator Component ───────────────────────────────────────────────

function SortIndicator({
  column,
  currentColumn,
  direction,
}: {
  column: SortColumn;
  currentColumn: SortColumn;
  direction: SortDirection;
}) {
  if (currentColumn !== column) {
    return <ArrowUpDown className="size-3.5 text-muted-foreground/30 shrink-0" />;
  }
  return direction === 'asc' ? (
    <ArrowUp className="size-3.5 text-primary shrink-0" />
  ) : (
    <ArrowDown className="size-3.5 text-primary shrink-0" />
  );
}


// ─── Main Component ─────────────────────────────────────────────────────────

export function EmployeeListClient({
  initialEmployees,
  initialStats,
  branches,
}: EmployeeListClientProps) {
  const router = useRouter();
  const user = useAuth();
  const [isPending, startTransition] = useTransition();

  // Data state
  const [employees, setEmployees] = useState<EmployeeItem[]>(initialEmployees);
  const [stats, setStats] = useState<EmployeeStats>(initialStats);

  // Search state (the only active filter on this page)
  const [searchQuery, setSearchQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Sorting state (Default: Employee A–Z)
  const [sortColumn, setSortColumn] = useState<SortColumn>('employee');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Pagination state (Default: 10 items per page with 10, 25, 50 options)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Salary Privacy: Hidden by default (stores set of employee IDs with revealed salaries)
  const [revealedSalaries, setRevealedSalaries] = useState<Set<string>>(new Set());

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeItem | null>(null);

  // Permission checks
  const canCreate = hasPermission(user, PERMISSIONS.EMPLOYEE_CREATE);
  const canUpdate = hasPermission(user, PERMISSIONS.EMPLOYEE_UPDATE);
  const canDeactivate = hasPermission(user, PERMISSIONS.EMPLOYEE_DEACTIVATE);

  // ─── Data Fetching ────────────────────────────────────────────────────────

  const fetchEmployees = useCallback((search?: string) => {
    startTransition(async () => {
      const result = await getEmployees({
        search: search || undefined,
      });

      if (result.success && result.data) {
        setEmployees(result.data);
      } else {
        toast.error(result.error ?? 'Failed to load employees');
      }
    });
  }, []);

  const refreshData = useCallback(() => {
    fetchEmployees(searchQuery);
    // Refresh stats
    startTransition(async () => {
      const statsResult = await getEmployeeStats();
      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data);
      }
    });
  }, [fetchEmployees, searchQuery]);

  // ─── Search Debounce ──────────────────────────────────────────────────────

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchEmployees(value);
    }, 300);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setCurrentPage(1);
    fetchEmployees('');
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ─── Sorting Logic ────────────────────────────────────────────────────────

  const handleSort = (column: SortColumn) => {
    setCurrentPage(1);
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedEmployees = useMemo(() => {
    const list = [...employees];
    return list.sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case 'employee': {
          const nameA = `${a.firstName} ${a.lastName}`.trim().toLowerCase();
          const nameB = `${b.firstName} ${b.lastName}`.trim().toLowerCase();
          comparison = nameA.localeCompare(nameB);
          break;
        }
        case 'code': {
          comparison = (a.employeeCode || '').localeCompare(b.employeeCode || '');
          break;
        }
        case 'designation': {
          comparison = (a.designation || '').localeCompare(b.designation || '');
          break;
        }
        case 'branch': {
          const branchA = a.branch?.name || '';
          const branchB = b.branch?.name || '';
          comparison = branchA.localeCompare(branchB);
          break;
        }
        case 'joiningDate': {
          const timeA = a.joiningDate ? new Date(a.joiningDate).getTime() : 0;
          const timeB = b.joiningDate ? new Date(b.joiningDate).getTime() : 0;
          comparison = timeA - timeB;
          break;
        }
        case 'salary': {
          const salA = Number(a.salary) || 0;
          const salB = Number(b.salary) || 0;
          comparison = salA - salB;
          break;
        }
        case 'status': {
          comparison = (a.employmentStatus || '').localeCompare(b.employmentStatus || '');
          break;
        }
      }

      // Stable secondary tiebreaker
      if (comparison === 0) {
        return (a.employeeCode || a.id).localeCompare(b.employeeCode || b.id);
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [employees, sortColumn, sortDirection]);

  // ─── Pagination Calculations ──────────────────────────────────────────────

  const totalItems = sortedEmployees.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const activePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = totalItems === 0 ? 0 : (activePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  const paginatedEmployees = useMemo(() => {
    return sortedEmployees.slice(startIndex, endIndex);
  }, [sortedEmployees, startIndex, endIndex]);

  const handlePageChange = (newPage: number) => {
    const clamped = Math.max(1, Math.min(newPage, totalPages));
    setCurrentPage(clamped);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  // ─── Salary Visibility Logic ──────────────────────────────────────────────

  const allSalariesVisible =
    paginatedEmployees.length > 0 &&
    paginatedEmployees.every((emp) => revealedSalaries.has(emp.id));

  const toggleSingleSalary = (id: string) => {
    setRevealedSalaries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllSalaries = () => {
    if (allSalariesVisible) {
      // Hiding row salaries for current visible page
      setRevealedSalaries((prev) => {
        const next = new Set(prev);
        paginatedEmployees.forEach((emp) => next.delete(emp.id));
        return next;
      });
    } else {
      // Revealing row salaries for current visible page
      setRevealedSalaries((prev) => {
        const next = new Set(prev);
        paginatedEmployees.forEach((emp) => next.add(emp.id));
        return next;
      });
    }
  };

  // ─── Actions ──────────────────────────────────────────────────────────────

  const handleEdit = (emp: EmployeeItem) => {
    setSelectedEmployee(emp);
    setEditDialogOpen(true);
  };

  const handleDelete = (emp: EmployeeItem) => {
    setSelectedEmployee(emp);
    setDeleteDialogOpen(true);
  };

  const handleRowClick = (emp: EmployeeItem) => {
    router.push(`/employees/${emp.id}`);
  };

  const handleFormSuccess = () => {
    setCreateDialogOpen(false);
    setEditDialogOpen(false);
    setSelectedEmployee(null);
    refreshData();
  };

  const handleDeleteSuccess = () => {
    setDeleteDialogOpen(false);
    setSelectedEmployee(null);
    refreshData();
  };

  // ─── Formatters ───────────────────────────────────────────────────────────

  const formatCurrency = (amount: number, type: string) => {
    const formatted = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);

    switch (type) {
      case 'MONTHLY':
        return `${formatted}/mo`;
      case 'DAILY':
        return `${formatted}/day`;
      case 'HOURLY':
        return `${formatted}/hr`;
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
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
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

      {/* Responsive Search Bar (Three filters removed as requested) */}
      <div className="flex items-center gap-3">
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
        {searchQuery.trim().length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearSearch} className="text-xs">
            Clear
          </Button>
        )}
      </div>

      {/* Loading State */}
      {isPending && employees.length === 0 && (
        <TableSkeleton rows={5} columns={8} />
      )}

      {/* Empty State */}
      {!isPending && sortedEmployees.length === 0 && (
        <EmptyState
          icon={Users}
          title={searchQuery ? 'No matching employees' : 'No employees yet'}
          description={
            searchQuery
              ? `No staff records matched "${searchQuery}". Try searching with a different term.`
              : 'Add staff members to assign them to branches and manage compensation.'
          }
          action={
            searchQuery
              ? { label: 'Clear Search', onClick: clearSearch }
              : canCreate
                ? { label: 'Add Employee', onClick: () => setCreateDialogOpen(true) }
                : undefined
          }
        />
      )}

      {/* Desktop / Tablet Data Table with Clickable Sort Headers & Visibility Controls */}
      {sortedEmployees.length > 0 && (
        <div className="hidden rounded-lg border md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {/* Employee Header */}
                <TableHead>
                  <button
                    type="button"
                    onClick={() => handleSort('employee')}
                    className="cursor-pointer select-none hover:text-foreground inline-flex items-center gap-1.5 transition-colors font-semibold"
                    aria-label={`Sort by Employee name, currently ${sortColumn === 'employee' ? sortDirection : 'none'}`}
                  >
                    <span>Employee</span>
                    <SortIndicator column="employee" currentColumn={sortColumn} direction={sortDirection} />
                  </button>
                </TableHead>

                {/* Code Header */}
                <TableHead>
                  <button
                    type="button"
                    onClick={() => handleSort('code')}
                    className="cursor-pointer select-none hover:text-foreground inline-flex items-center gap-1.5 transition-colors font-semibold"
                    aria-label={`Sort by Code, currently ${sortColumn === 'code' ? sortDirection : 'none'}`}
                  >
                    <span>Code</span>
                    <SortIndicator column="code" currentColumn={sortColumn} direction={sortDirection} />
                  </button>
                </TableHead>

                {/* Designation Header */}
                <TableHead>
                  <button
                    type="button"
                    onClick={() => handleSort('designation')}
                    className="cursor-pointer select-none hover:text-foreground inline-flex items-center gap-1.5 transition-colors font-semibold"
                    aria-label={`Sort by Designation, currently ${sortColumn === 'designation' ? sortDirection : 'none'}`}
                  >
                    <span>Designation</span>
                    <SortIndicator column="designation" currentColumn={sortColumn} direction={sortDirection} />
                  </button>
                </TableHead>

                {/* Branch Header */}
                <TableHead>
                  <button
                    type="button"
                    onClick={() => handleSort('branch')}
                    className="cursor-pointer select-none hover:text-foreground inline-flex items-center gap-1.5 transition-colors font-semibold"
                    aria-label={`Sort by Branch, currently ${sortColumn === 'branch' ? sortDirection : 'none'}`}
                  >
                    <span>Branch</span>
                    <SortIndicator column="branch" currentColumn={sortColumn} direction={sortDirection} />
                  </button>
                </TableHead>

                {/* Joining Date Header */}
                <TableHead className="hidden lg:table-cell">
                  <button
                    type="button"
                    onClick={() => handleSort('joiningDate')}
                    className="cursor-pointer select-none hover:text-foreground inline-flex items-center gap-1.5 transition-colors font-semibold"
                    aria-label={`Sort by Joining Date, currently ${sortColumn === 'joiningDate' ? sortDirection : 'none'}`}
                  >
                    <span>Joining Date</span>
                    <SortIndicator column="joiningDate" currentColumn={sortColumn} direction={sortDirection} />
                  </button>
                </TableHead>

                {/* Salary Header with Global Visibility Control */}
                <TableHead className="group">
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => handleSort('salary')}
                      className="cursor-pointer select-none hover:text-foreground inline-flex items-center gap-1.5 transition-colors font-semibold"
                      aria-label={`Sort by Salary, currently ${sortColumn === 'salary' ? sortDirection : 'none'}`}
                    >
                      <span>Salary</span>
                      <SortIndicator column="salary" currentColumn={sortColumn} direction={sortDirection} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAllSalaries();
                      }}
                      className="ml-2 inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary opacity-80 md:opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                      aria-label={allSalariesVisible ? 'Hide all salaries' : 'Show all salaries'}
                      title={allSalariesVisible ? 'Hide all salaries' : 'Show all salaries'}
                    >
                      {allSalariesVisible ? (
                        <EyeOff className="size-3.5 text-primary" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                    </button>
                  </div>
                </TableHead>

                {/* Status Header */}
                <TableHead>
                  <button
                    type="button"
                    onClick={() => handleSort('status')}
                    className="cursor-pointer select-none hover:text-foreground inline-flex items-center gap-1.5 transition-colors font-semibold"
                    aria-label={`Sort by Status, currently ${sortColumn === 'status' ? sortDirection : 'none'}`}
                  >
                    <span>Status</span>
                    <SortIndicator column="status" currentColumn={sortColumn} direction={sortDirection} />
                  </button>
                </TableHead>

                {/* Actions Header */}
                <TableHead className="w-24 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedEmployees.map((emp) => {
                const isSalaryRevealed = revealedSalaries.has(emp.id);

                return (
                  <TableRow
                    key={emp.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleRowClick(emp)}
                  >
                    {/* Employee Name & Contact */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {getInitials(emp.firstName, emp.lastName)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 font-medium text-foreground">
                            <span>
                              {emp.firstName} {emp.lastName}
                            </span>
                            {emp.user && (
                              <span title="Linked to application user account">
                                <Badge
                                  variant="outline"
                                  className="px-1 py-0 text-[10px] font-normal text-muted-foreground"
                                >
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

                    {/* Salary with Per-Row Privacy Masking */}
                    <TableCell>
                      <div className="flex items-center gap-2 font-mono text-sm">
                        <span className="min-w-24 tabular-nums font-medium text-foreground">
                          {isSalaryRevealed ? (
                            formatCurrency(emp.salary, emp.salaryType)
                          ) : (
                            <span className="tracking-widest text-muted-foreground">••••••</span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSingleSalary(emp.id);
                          }}
                          className="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          aria-label={isSalaryRevealed ? 'Hide salary' : 'Show salary'}
                          title={isSalaryRevealed ? 'Hide salary' : 'Show salary'}
                        >
                          {isSalaryRevealed ? (
                            <EyeOff className="size-3.5" />
                          ) : (
                            <Eye className="size-3.5" />
                          )}
                        </button>
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

                    {/* Directly Visible Action Buttons (Replaces Three-Dot Menu) */}
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {canUpdate && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(emp);
                            }}
                            aria-label={`Edit employee ${emp.firstName} ${emp.lastName}`}
                            title="Edit employee"
                          >
                            <Pencil className="size-4" />
                          </Button>
                        )}

                        {canDeactivate && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(emp);
                            }}
                            aria-label={`Delete employee ${emp.firstName} ${emp.lastName}`}
                            title="Delete employee"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Desktop Pagination Footer */}
          <DataTablePagination
            currentPage={activePage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            pageSizeOptions={[10, 25, 50]}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            isLoading={isPending}
            itemLabel="employees"
          />
        </div>
      )}

      {/* Mobile Cards Layout */}
      {sortedEmployees.length > 0 && (
        <div className="grid gap-3 md:hidden">
          {paginatedEmployees.map((emp) => {
            const isSalaryRevealed = revealedSalaries.has(emp.id);

            return (
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
                      <div className="flex items-center gap-1.5 font-mono text-foreground font-medium">
                        <span>
                          {isSalaryRevealed
                            ? formatCurrency(emp.salary, emp.salaryType)
                            : '••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleSingleSalary(emp.id)}
                          className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                          aria-label={isSalaryRevealed ? 'Hide salary' : 'Show salary'}
                        >
                          {isSalaryRevealed ? (
                            <EyeOff className="size-3" />
                          ) : (
                            <Eye className="size-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t pt-2">
                    <span className="text-xs text-muted-foreground">
                      Joined {formatDate(emp.joiningDate)}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRowClick(emp)}
                        className="h-8 text-xs"
                      >
                        <Eye className="mr-1 size-3.5" />
                        View
                      </Button>
                      {canUpdate && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleEdit(emp)}
                          aria-label="Edit employee"
                          title="Edit employee"
                        >
                          <Pencil className="size-4" />
                        </Button>
                      )}
                      {canDeactivate && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDelete(emp)}
                          aria-label="Delete employee"
                          title="Delete employee"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Mobile Pagination Card */}
          <div className="rounded-xl border bg-card shadow-xs">
            <DataTablePagination
              currentPage={activePage}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              pageSizeOptions={[10, 25, 50]}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              isLoading={isPending}
              itemLabel="employees"
            />
          </div>
        </div>
      )}

      {/* Form Dialog for Creating New Employee */}
      <EmployeeFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        branches={branches}
        onSuccess={handleFormSuccess}
      />

      {/* Form Dialog for Editing Employee */}
      {selectedEmployee && editDialogOpen && (
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

      {/* Safe Deletion / Deactivation Confirmation Dialog */}
      {selectedEmployee && deleteDialogOpen && (
        <EmployeeDeleteDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) setSelectedEmployee(null);
          }}
          employee={selectedEmployee}
          onSuccess={handleDeleteSuccess}
        />
      )}
    </div>
  );
}
