'use client';

import { useState, useTransition, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plus,
  Eye,
  Pencil,
  Search,
  Users,
  LogOut,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  getAttendanceRecords,
  getAttendanceSummary,
  quickCheckOut,
  type AttendanceItem,
  type AttendanceSummary,
  type ShiftItem,
} from '@/lib/attendance/actions';
import { useRealtime } from '@/lib/realtime/use-realtime';
import { useAuth } from '@/providers/auth-provider';
import { hasPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';

import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
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

import {
  AttendanceFormDialog,
  type BranchOption,
  type EmployeeOption,
} from '@/components/attendance/attendance-form-dialog';
import { AttendanceKpiDialog, type KpiType } from '@/components/attendance/attendance-kpi-dialog';

// ─── Types ──────────────────────────────────────────────────────────────────

type AttendanceSortColumn =
  | 'employee'
  | 'branch'
  | 'status'
  | 'checkIn'
  | 'checkOut'
  | 'markedBy';

type SortDirection = 'asc' | 'desc';

interface AttendanceListClientProps {
  initialAttendance: AttendanceItem[];
  initialSummary: AttendanceSummary;
  initialShifts: ShiftItem[];
  branches: BranchOption[];
  employees: EmployeeOption[];
  todayDate: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTimeDisplay(date: Date | string | null): string {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function SortIndicator({
  column,
  currentColumn,
  direction,
}: {
  column: AttendanceSortColumn;
  currentColumn: AttendanceSortColumn;
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

// ─── Component ──────────────────────────────────────────────────────────────

export function AttendanceListClient({
  initialAttendance,
  initialSummary,
  initialShifts,
  branches,
  employees,
  todayDate,
}: AttendanceListClientProps) {
  const router = useRouter();
  const user = useAuth();
  const [isPending, startTransition] = useTransition();

  // Attendance Data
  const [attendance, setAttendance] = useState<AttendanceItem[]>(initialAttendance);
  const [summary, setSummary] = useState<AttendanceSummary>(initialSummary);

  // Shifts Data (kept in state for AttendanceFormDialog)
  const [shifts] = useState<ShiftItem[]>(initialShifts);

  // Date and Search State
  const [dateFilter, setDateFilter] = useState<string>(todayDate);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sorting State
  const [sortColumn, setSortColumn] = useState<AttendanceSortColumn>('employee');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // KPI Modal State
  const [kpiModalType, setKpiModalType] = useState<KpiType>(null);
  const [kpiModalOpen, setKpiModalOpen] = useState(false);

  // Attendance Record Dialog
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState<AttendanceItem | null>(null);

  // Permissions
  const canCreateAttendance = hasPermission(user, PERMISSIONS.ATTENDANCE_CREATE);
  const canUpdateAttendance = hasPermission(user, PERMISSIONS.ATTENDANCE_UPDATE);

  // ─── Data Refetching ──────────────────────────────────────────────────────

  const refreshAttendance = useCallback(
    (targetDate?: string) => {
      startTransition(async () => {
        const d = targetDate ?? dateFilter;

        const [recordsRes, summaryRes] = await Promise.all([
          getAttendanceRecords({ date: d }),
          getAttendanceSummary(d),
        ]);

        if (recordsRes.success && recordsRes.data) {
          setAttendance(recordsRes.data);
        } else {
          toast.error(recordsRes.error ?? 'Failed to refresh attendance.');
        }

        if (summaryRes.success && summaryRes.data) {
          setSummary(summaryRes.data);
        }
      });
    },
    [dateFilter]
  );

  // ─── Real-Time Updates ──────────────────────────────────────────────────
  useRealtime({
    eventTypes: ['attendance:updated'],
    onEvent: (msg) => {
      if (msg.type === 'attendance:updated') {
        refreshAttendance();
      }
    },
  });

  // ─── Date Nav Shortcuts ─────────────────────────────────────────────────

  const handleShiftDate = (days: number) => {
    const [y, m, d] = dateFilter.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + days);
    const newDateStr = dateObj.toISOString().split('T')[0];
    setDateFilter(newDateStr);
    refreshAttendance(newDateStr);
  };

  const handleSetToday = () => {
    setDateFilter(todayDate);
    refreshAttendance(todayDate);
  };

  // Quick Check Out Action
  const handleQuickCheckOut = (recordId: string, empName: string) => {
    startTransition(async () => {
      const res = await quickCheckOut(recordId);
      if (res.success) {
        toast.success(`Check-out recorded for ${empName}.`);
        refreshAttendance();
      } else {
        toast.error(res.error ?? 'Failed to record check-out.');
      }
    });
  };

  // ─── Filter & Sorting Logic ─────────────────────────────────────────────

  const handleSort = (column: AttendanceSortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const filteredAttendance = useMemo(() => {
    if (!searchQuery.trim()) return attendance;
    const q = searchQuery.toLowerCase().trim();
    return attendance.filter(
      (a) =>
        a.employee.firstName.toLowerCase().includes(q) ||
        a.employee.lastName.toLowerCase().includes(q) ||
        a.employee.employeeCode.toLowerCase().includes(q) ||
        a.employee.designation.toLowerCase().includes(q) ||
        a.branch.name.toLowerCase().includes(q)
    );
  }, [attendance, searchQuery]);

  const sortedAttendance = useMemo(() => {
    const list = [...filteredAttendance];
    return list.sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case 'employee': {
          const nameA = `${a.employee.firstName} ${a.employee.lastName}`.toLowerCase();
          const nameB = `${b.employee.firstName} ${b.employee.lastName}`.toLowerCase();
          comparison = nameA.localeCompare(nameB);
          break;
        }

        case 'branch': {
          const branchA = (a.branch.name || '').toLowerCase();
          const branchB = (b.branch.name || '').toLowerCase();
          comparison = branchA.localeCompare(branchB);
          break;
        }

        case 'status': {
          const statusA = a.status || '';
          const statusB = b.status || '';
          comparison = statusA.localeCompare(statusB);
          break;
        }

        case 'checkIn': {
          const timeA = a.checkIn ? new Date(a.checkIn).getTime() : null;
          const timeB = b.checkIn ? new Date(b.checkIn).getTime() : null;
          if (timeA === null && timeB === null) {
            comparison = 0;
          } else if (timeA === null) {
            return 1;
          } else if (timeB === null) {
            return -1;
          } else {
            comparison = timeA - timeB;
          }
          break;
        }

        case 'checkOut': {
          const timeA = a.checkOut ? new Date(a.checkOut).getTime() : null;
          const timeB = b.checkOut ? new Date(b.checkOut).getTime() : null;
          if (timeA === null && timeB === null) {
            comparison = 0;
          } else if (timeA === null) {
            return 1;
          } else if (timeB === null) {
            return -1;
          } else {
            comparison = timeA - timeB;
          }
          break;
        }

        case 'markedBy': {
          const markedA = (a.markedBy || 'System').toLowerCase();
          const markedB = (b.markedBy || 'System').toLowerCase();
          comparison = markedA.localeCompare(markedB);
          break;
        }
      }

      if (comparison === 0) {
        return (a.employee.employeeCode || a.id).localeCompare(b.employee.employeeCode || b.id);
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredAttendance, sortColumn, sortDirection]);

  // Open KPI Modal
  const openKpiModal = (type: KpiType) => {
    setKpiModalType(type);
    setKpiModalOpen(true);
  };

  // Status Badge Renderer
  const renderStatusBadge = (status: AttendanceItem['status']) => {
    switch (status) {
      case 'PRESENT':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 font-medium">
            <CheckCircle2 className="size-3.5" />
            Present
          </Badge>
        );
      case 'ABSENT':
        return (
          <Badge variant="destructive" className="gap-1 font-medium">
            <XCircle className="size-3.5" />
            Absent
          </Badge>
        );
      case 'HALF_DAY':
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1 font-medium">
            <Clock className="size-3.5" />
            Half Day
          </Badge>
        );
      case 'LEAVE':
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 gap-1 font-medium">
            <Calendar className="size-3.5" />
            Leave
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Attendance"
        description="Monitor employee attendance across restaurant branches."
      >
        {canCreateAttendance && (
          <Button
            onClick={() => {
              setSelectedAttendance(null);
              setAttendanceDialogOpen(true);
            }}
            size="sm"
          >
            <Plus className="mr-1.5 size-4" />
            Mark Attendance
          </Button>
        )}
      </PageHeader>

      {/* Date Selector Navigation Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3 shadow-xs">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="size-8 p-0"
            onClick={() => handleShiftDate(-1)}
            title="Previous Day"
            disabled={isPending}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant={dateFilter === todayDate ? 'default' : 'outline'}
            size="sm"
            onClick={handleSetToday}
            disabled={isPending}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="size-8 p-0"
            onClick={() => handleShiftDate(1)}
            title="Next Day"
            disabled={isPending}
          >
            <ChevronRight className="size-4" />
          </Button>

          <div className="flex items-center gap-2 pl-2">
            <CalendarDays className="size-4 text-muted-foreground hidden sm:block" />
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => {
                if (e.target.value) {
                  setDateFilter(e.target.value);
                  refreshAttendance(e.target.value);
                }
              }}
              className="h-8 w-36 text-xs sm:w-40 sm:text-sm"
              disabled={isPending}
            />
            <span className="text-xs font-medium text-muted-foreground hidden md:inline">
              ({formatDateDisplay(dateFilter)})
            </span>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Showing records for <strong className="text-foreground">{formatDateDisplay(dateFilter)}</strong>
        </div>
      </div>

      {/* Clickable Attendance KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {/* 1. Active Staff */}
        <Card
          role="button"
          tabIndex={0}
          onClick={() => openKpiModal('active')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openKpiModal('active');
            }
          }}
          className="p-3 shadow-xs cursor-pointer select-none transition-all hover:scale-[1.02] hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          <div className="text-xs font-medium text-muted-foreground">Active Staff</div>
          <div className="mt-1 text-2xl font-bold tracking-tight">{summary.totalEmployees}</div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Users className="size-3" /> In Scope
          </div>
        </Card>

        {/* 2. Present */}
        <Card
          role="button"
          tabIndex={0}
          onClick={() => openKpiModal('present')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openKpiModal('present');
            }
          }}
          className="p-3 shadow-xs cursor-pointer select-none transition-all hover:scale-[1.02] hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none border-emerald-500/20 bg-emerald-500/5"
        >
          <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Present</div>
          <div className="mt-1 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {summary.present}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600/80">
            <CheckCircle2 className="size-3" /> Full Day
          </div>
        </Card>

        {/* 3. Absent */}
        <Card
          role="button"
          tabIndex={0}
          onClick={() => openKpiModal('absent')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openKpiModal('absent');
            }
          }}
          className="p-3 shadow-xs cursor-pointer select-none transition-all hover:scale-[1.02] hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none border-destructive/20 bg-destructive/5"
        >
          <div className="text-xs font-medium text-destructive">Absent</div>
          <div className="mt-1 text-2xl font-bold tracking-tight text-destructive">{summary.absent}</div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-destructive/80">
            <XCircle className="size-3" /> No Show
          </div>
        </Card>

        {/* 4. Half Day */}
        <Card
          role="button"
          tabIndex={0}
          onClick={() => openKpiModal('halfDay')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openKpiModal('halfDay');
            }
          }}
          className="p-3 shadow-xs cursor-pointer select-none transition-all hover:scale-[1.02] hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none border-amber-500/20 bg-amber-500/5"
        >
          <div className="text-xs font-medium text-amber-700 dark:text-amber-400">Half Day</div>
          <div className="mt-1 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
            {summary.halfDay}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-600/80">
            <Clock className="size-3" /> Partial
          </div>
        </Card>

        {/* 5. On Leave */}
        <Card
          role="button"
          tabIndex={0}
          onClick={() => openKpiModal('leave')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openKpiModal('leave');
            }
          }}
          className="p-3 shadow-xs cursor-pointer select-none transition-all hover:scale-[1.02] hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none border-blue-500/20 bg-blue-500/5"
        >
          <div className="text-xs font-medium text-blue-700 dark:text-blue-400">On Leave</div>
          <div className="mt-1 text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
            {summary.leave}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-blue-600/80">
            <Calendar className="size-3" /> Approved
          </div>
        </Card>

        {/* 6. Late Arrivals */}
        <Card
          role="button"
          tabIndex={0}
          onClick={() => openKpiModal('late')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openKpiModal('late');
            }
          }}
          className="p-3 shadow-xs cursor-pointer select-none transition-all hover:scale-[1.02] hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none border-orange-500/20 bg-orange-500/5"
        >
          <div className="text-xs font-medium text-orange-700 dark:text-orange-400">Late Arrivals</div>
          <div className="mt-1 text-2xl font-bold tracking-tight text-orange-600 dark:text-orange-400">
            {summary.late}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-orange-600/80">
            <AlertTriangle className="size-3" /> Late check-in
          </div>
        </Card>

        {/* 7. Early Departure */}
        <Card
          role="button"
          tabIndex={0}
          onClick={() => openKpiModal('earlyDeparture')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openKpiModal('earlyDeparture');
            }
          }}
          className="p-3 shadow-xs cursor-pointer select-none transition-all hover:scale-[1.02] hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none border-amber-500/20 bg-amber-500/5 col-span-2 sm:col-span-1"
        >
          <div className="text-xs font-medium text-amber-700 dark:text-amber-400">Early Dep.</div>
          <div className="mt-1 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
            {summary.earlyDeparture}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-600/80">
            <LogOut className="size-3" /> Early leave
          </div>
        </Card>
      </div>

      {/* Employee Search Bar (Four dropdown filters removed) */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            id="attendance-search"
            placeholder="Search employee name, code, designation, or branch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        {searchQuery.trim().length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchQuery('')}
            className="text-xs"
          >
            Clear
          </Button>
        )}
      </div>

      {/* Attendance Table & List */}
      {isPending && attendance.length === 0 ? (
        <TableSkeleton columns={7} rows={6} />
      ) : sortedAttendance.length === 0 ? (
        <EmptyState
          title={searchQuery ? 'No matching attendance records' : 'No attendance records found'}
          description={
            searchQuery
              ? `No records match "${searchQuery}" for ${formatDateDisplay(dateFilter)}.`
              : `No employee attendance has been recorded for ${formatDateDisplay(dateFilter)}.`
          }
          action={
            searchQuery
              ? { label: 'Clear Search', onClick: () => setSearchQuery('') }
              : canCreateAttendance
                ? {
                    label: 'Record Attendance',
                    onClick: () => {
                      setSelectedAttendance(null);
                      setAttendanceDialogOpen(true);
                    },
                  }
                : undefined
          }
        />
      ) : (
        <>
          {/* Desktop Table with Clickable Sort Headers (Shift column removed) */}
          <div className="hidden md:block rounded-lg border bg-card shadow-xs overflow-hidden">
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

                  {/* Check-In Header */}
                  <TableHead>
                    <button
                      type="button"
                      onClick={() => handleSort('checkIn')}
                      className="cursor-pointer select-none hover:text-foreground inline-flex items-center gap-1.5 transition-colors font-semibold"
                      aria-label={`Sort by Check-In time, currently ${sortColumn === 'checkIn' ? sortDirection : 'none'}`}
                    >
                      <span>Check-In</span>
                      <SortIndicator column="checkIn" currentColumn={sortColumn} direction={sortDirection} />
                    </button>
                  </TableHead>

                  {/* Check-Out Header */}
                  <TableHead>
                    <button
                      type="button"
                      onClick={() => handleSort('checkOut')}
                      className="cursor-pointer select-none hover:text-foreground inline-flex items-center gap-1.5 transition-colors font-semibold"
                      aria-label={`Sort by Check-Out time, currently ${sortColumn === 'checkOut' ? sortDirection : 'none'}`}
                    >
                      <span>Check-Out</span>
                      <SortIndicator column="checkOut" currentColumn={sortColumn} direction={sortDirection} />
                    </button>
                  </TableHead>

                  {/* Marked By Header */}
                  <TableHead>
                    <button
                      type="button"
                      onClick={() => handleSort('markedBy')}
                      className="cursor-pointer select-none hover:text-foreground inline-flex items-center gap-1.5 transition-colors font-semibold"
                      aria-label={`Sort by Marked By, currently ${sortColumn === 'markedBy' ? sortDirection : 'none'}`}
                    >
                      <span>Marked By</span>
                      <SortIndicator column="markedBy" currentColumn={sortColumn} direction={sortDirection} />
                    </button>
                  </TableHead>

                  {/* Actions Header */}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAttendance.map((record) => {
                  const isCheckedInWithoutOut =
                    record.checkIn && !record.checkOut && record.status === 'PRESENT';

                  return (
                    <TableRow key={record.id}>
                      {/* Employee (No shift info) */}
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {record.employee.firstName[0]}
                            {record.employee.lastName[0]}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-foreground">
                              {record.employee.firstName} {record.employee.lastName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {record.employee.employeeCode} • {record.employee.designation}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Branch */}
                      <TableCell>
                        <span className="text-sm font-medium">{record.branch.name}</span>
                        <span className="block text-xs text-muted-foreground">{record.branch.city}</span>
                      </TableCell>

                      {/* Status */}
                      <TableCell>{renderStatusBadge(record.status)}</TableCell>

                      {/* Check-In */}
                      <TableCell>
                        <div className="flex flex-col gap-0.5 font-mono">
                          <span className="text-xs font-medium">
                            {formatTimeDisplay(record.checkIn)}
                          </span>
                          {record.lateMinutes > 0 && (
                            <Badge variant="destructive" className="w-fit text-[10px] py-0 px-1 font-mono">
                              +{record.lateMinutes}m Late
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* Check-Out */}
                      <TableCell>
                        <div className="flex flex-col gap-0.5 font-mono">
                          <span className="text-xs font-medium">
                            {formatTimeDisplay(record.checkOut)}
                          </span>
                          {record.earlyDepartureMinutes > 0 && (
                            <Badge className="w-fit text-[10px] py-0 px-1 font-mono bg-amber-600 hover:bg-amber-700">
                              -{record.earlyDepartureMinutes}m Early
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* Marked By */}
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {record.markedBy ?? 'System'}
                        </span>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isCheckedInWithoutOut && canUpdateAttendance && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs gap-1 border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                              onClick={() =>
                                handleQuickCheckOut(
                                  record.id,
                                  `${record.employee.firstName} ${record.employee.lastName}`
                                )
                              }
                              title="Quick Check Out Now"
                            >
                              <LogOut className="size-3" />
                              Check Out
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => router.push(`/attendance/${record.id}`)}
                            title="View Details"
                            aria-label={`View details for ${record.employee.firstName} ${record.employee.lastName}`}
                          >
                            <Eye className="size-4 text-muted-foreground" />
                          </Button>

                          {canUpdateAttendance && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                setSelectedAttendance(record);
                                setAttendanceDialogOpen(true);
                              }}
                              title="Edit Record"
                              aria-label={`Edit attendance for ${record.employee.firstName} ${record.employee.lastName}`}
                            >
                              <Pencil className="size-4 text-muted-foreground" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card List (Shift row removed) */}
          <div className="space-y-3 md:hidden">
            {sortedAttendance.map((record) => {
              const isCheckedInWithoutOut =
                record.checkIn && !record.checkOut && record.status === 'PRESENT';

              return (
                <Card key={record.id} className="p-4 shadow-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {record.employee.firstName[0]}
                        {record.employee.lastName[0]}
                      </div>
                      <div>
                        <div className="font-medium text-sm">
                          {record.employee.firstName} {record.employee.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {record.employee.employeeCode} • {record.employee.designation}
                        </div>
                      </div>
                    </div>
                    {renderStatusBadge(record.status)}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-2.5 text-xs">
                    <div>
                      <span className="text-muted-foreground">Branch:</span>{' '}
                      <strong>{record.branch.name}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Marked By:</span>{' '}
                      <span>{record.markedBy ?? 'System'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Check-In:</span>{' '}
                      <span className="font-mono font-medium">
                        {formatTimeDisplay(record.checkIn)}
                      </span>
                      {record.lateMinutes > 0 && (
                        <span className="ml-1 text-[10px] text-destructive font-mono">
                          (+{record.lateMinutes}m)
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Check-Out:</span>{' '}
                      <span className="font-mono font-medium">
                        {formatTimeDisplay(record.checkOut)}
                      </span>
                      {record.earlyDepartureMinutes > 0 && (
                        <span className="ml-1 text-[10px] text-amber-600 font-mono">
                          (-{record.earlyDepartureMinutes}m)
                        </span>
                      )}
                    </div>
                  </div>

                  {record.note && (
                    <div className="mt-2 rounded bg-muted/40 p-2 text-xs text-muted-foreground">
                      Note: {record.note}
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-end border-t pt-2.5 text-xs text-muted-foreground gap-1.5 flex-wrap">
                    {isCheckedInWithoutOut && canUpdateAttendance && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-9 text-xs px-3 gap-1.5 border-amber-500/40 text-amber-700 dark:text-amber-400"
                        onClick={() =>
                          handleQuickCheckOut(
                            record.id,
                            `${record.employee.firstName} ${record.employee.lastName}`
                          )
                        }
                      >
                        <LogOut className="size-3.5" />
                        Check Out
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-9 px-3 text-xs"
                      onClick={() => router.push(`/attendance/${record.id}`)}
                    >
                      Details
                    </Button>
                    {canUpdateAttendance && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-9 px-3 text-xs"
                        onClick={() => {
                          setSelectedAttendance(record);
                          setAttendanceDialogOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Attendance Form Dialog (Create / Edit) */}
      <AttendanceFormDialog
        open={attendanceDialogOpen}
        onOpenChange={setAttendanceDialogOpen}
        record={selectedAttendance}
        defaultDate={dateFilter}
        defaultBranchId={branches[0]?.id}
        branches={branches}
        employees={employees}
        shifts={shifts}
        onSuccess={() => refreshAttendance()}
      />

      {/* Interactive KPI Dialog */}
      <AttendanceKpiDialog
        open={kpiModalOpen}
        onOpenChange={setKpiModalOpen}
        kpiType={kpiModalType}
        dateStr={dateFilter}
        attendanceRecords={attendance}
        activeEmployees={employees}
        branches={branches}
        onViewRecord={(recordId) => router.push(`/attendance/${recordId}`)}
      />
    </div>
  );
}
