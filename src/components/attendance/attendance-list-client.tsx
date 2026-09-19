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
  Power,
  Search,
  Users,
  LogOut,
  CalendarDays,
  Moon,
  ChevronLeft,
  ChevronRight,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  getAttendanceRecords,
  getAttendanceSummary,
  getShifts,
  quickCheckOut,
  type AttendanceItem,
  type AttendanceSummary,
  type ShiftItem,
} from '@/lib/attendance/actions';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/loading-skeleton';

import { AttendanceFormDialog, type BranchOption, type EmployeeOption } from '@/components/attendance/attendance-form-dialog';
import { ShiftFormDialog } from '@/components/attendance/shift-form-dialog';
import { ShiftStatusDialog } from '@/components/attendance/shift-status-dialog';

// ─── Props ──────────────────────────────────────────────────────────────────

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

function computeShiftHours(startTime: string, endTime: string): string {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  let totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
  let overnight = false;
  if (totalMinutes <= 0) {
    totalMinutes += 24 * 60;
    overnight = true;
  }
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}h${mins > 0 ? ` ${mins}m` : ''}${overnight ? ' (Overnight)' : ''}`;
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

  // Active Tab
  const [activeTab, setActiveTab] = useState<'attendance' | 'shifts'>('attendance');

  // Attendance Data
  const [attendance, setAttendance] = useState<AttendanceItem[]>(initialAttendance);
  const [summary, setSummary] = useState<AttendanceSummary>(initialSummary);

  // Shifts Data
  const [shifts, setShifts] = useState<ShiftItem[]>(initialShifts);

  // Attendance Filters
  const [dateFilter, setDateFilter] = useState<string>(todayDate);
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [employeeFilter, setEmployeeFilter] = useState<string>('ALL');
  const [shiftFilter, setShiftFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Shift Tab Branch Filter
  const [shiftBranchFilter, setShiftBranchFilter] = useState<string>('ALL');

  // Dialog States
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState<AttendanceItem | null>(null);

  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<ShiftItem | null>(null);

  const [shiftStatusDialogOpen, setShiftStatusDialogOpen] = useState(false);
  const [shiftToToggle, setShiftToToggle] = useState<ShiftItem | null>(null);

  // Permissions
  const canCreateAttendance = hasPermission(user, PERMISSIONS.ATTENDANCE_CREATE);
  const canUpdateAttendance = hasPermission(user, PERMISSIONS.ATTENDANCE_UPDATE);
  const canCreateShift = hasPermission(user, PERMISSIONS.SHIFT_CREATE);
  const canUpdateShift = hasPermission(user, PERMISSIONS.SHIFT_UPDATE);
  const canDeactivateShift = hasPermission(user, PERMISSIONS.SHIFT_DEACTIVATE);

  // ─── Data Refetching ──────────────────────────────────────────────────────

  const refreshAttendance = useCallback(
    (targetDate?: string, branch?: string, emp?: string, shift?: string, stat?: string) => {
      startTransition(async () => {
        const d = targetDate ?? dateFilter;
        const b = branch ?? branchFilter;
        const e = emp ?? employeeFilter;
        const s = shift ?? shiftFilter;
        const st = stat ?? statusFilter;

        const [recordsRes, summaryRes] = await Promise.all([
          getAttendanceRecords({
            date: d,
            branchId: b === 'ALL' ? undefined : b,
            employeeId: e === 'ALL' ? undefined : e,
            shiftId: s === 'ALL' ? undefined : s,
            status: st === 'ALL' ? undefined : (st as AttendanceItem['status']),
          }),
          getAttendanceSummary(d, b === 'ALL' ? undefined : b),
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
    [dateFilter, branchFilter, employeeFilter, shiftFilter, statusFilter]
  );

  const refreshShifts = useCallback(
    (branch?: string) => {
      startTransition(async () => {
        const b = branch ?? shiftBranchFilter;
        const res = await getShifts(b === 'ALL' ? undefined : b);
        if (res.success && res.data) {
          setShifts(res.data);
        } else {
          toast.error(res.error ?? 'Failed to refresh shifts.');
        }
      });
    },
    [shiftBranchFilter]
  );

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

  // Client-side search filtering
  const filteredAttendance = useMemo(() => {
    if (!searchQuery.trim()) return attendance;
    const q = searchQuery.toLowerCase().trim();
    return attendance.filter(
      (a) =>
        a.employee.firstName.toLowerCase().includes(q) ||
        a.employee.lastName.toLowerCase().includes(q) ||
        a.employee.employeeCode.toLowerCase().includes(q) ||
        a.employee.designation.toLowerCase().includes(q)
    );
  }, [attendance, searchQuery]);

  // Branch-filtered shifts for filter dropdown
  const filterShifts = useMemo(() => {
    if (branchFilter === 'ALL') return shifts;
    return shifts.filter((s) => s.branchId === branchFilter);
  }, [shifts, branchFilter]);

  // Branch-filtered employees for filter dropdown
  const filterEmployees = useMemo(() => {
    if (branchFilter === 'ALL') return employees;
    return employees.filter((e) => e.branchId === branchFilter);
  }, [employees, branchFilter]);

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
        <div className="flex items-center gap-2">
          {canCreateShift && activeTab === 'shifts' && (
            <Button
              onClick={() => {
                setSelectedShift(null);
                setShiftDialogOpen(true);
              }}
              size="sm"
            >
              <Plus className="mr-1.5 size-4" />
              Create Shift
            </Button>
          )}

          {canCreateAttendance && activeTab === 'attendance' && (
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
        </div>
      </PageHeader>

      {/* Tabs Navigation */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as 'attendance' | 'shifts')}
        className="w-full"
      >
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="attendance" className="gap-2">
            <UserCheck className="size-4" />
            Daily Attendance
          </TabsTrigger>
          <TabsTrigger value="shifts" className="gap-2">
            <Clock className="size-4" />
            Shift Schedules
          </TabsTrigger>
        </TabsList>

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* TAB 1: DAILY ATTENDANCE                                            */}
        {/* ────────────────────────────────────────────────────────────────── */}
        <TabsContent value="attendance" className="space-y-6 pt-4">
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

          {/* Attendance KPI Summary Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <Card className="p-3 shadow-xs">
              <div className="text-xs font-medium text-muted-foreground">Active Staff</div>
              <div className="mt-1 text-2xl font-bold tracking-tight">{summary.totalEmployees}</div>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                <Users className="size-3" /> In Scope
              </div>
            </Card>

            <Card className="p-3 shadow-xs border-emerald-500/20 bg-emerald-500/5">
              <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Present</div>
              <div className="mt-1 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {summary.present}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600/80">
                <CheckCircle2 className="size-3" /> Full Day
              </div>
            </Card>

            <Card className="p-3 shadow-xs border-destructive/20 bg-destructive/5">
              <div className="text-xs font-medium text-destructive">Absent</div>
              <div className="mt-1 text-2xl font-bold tracking-tight text-destructive">{summary.absent}</div>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-destructive/80">
                <XCircle className="size-3" /> No Show
              </div>
            </Card>

            <Card className="p-3 shadow-xs border-amber-500/20 bg-amber-500/5">
              <div className="text-xs font-medium text-amber-700 dark:text-amber-400">Half Day</div>
              <div className="mt-1 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                {summary.halfDay}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-600/80">
                <Clock className="size-3" /> Partial
              </div>
            </Card>

            <Card className="p-3 shadow-xs border-blue-500/20 bg-blue-500/5">
              <div className="text-xs font-medium text-blue-700 dark:text-blue-400">On Leave</div>
              <div className="mt-1 text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
                {summary.leave}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-blue-600/80">
                <Calendar className="size-3" /> Approved
              </div>
            </Card>

            <Card className="p-3 shadow-xs border-orange-500/20 bg-orange-500/5">
              <div className="text-xs font-medium text-orange-700 dark:text-orange-400">Late Arrivals</div>
              <div className="mt-1 text-2xl font-bold tracking-tight text-orange-600 dark:text-orange-400">
                {summary.late}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-orange-600/80">
                <AlertTriangle className="size-3" /> Late check-in
              </div>
            </Card>

            <Card className="p-3 shadow-xs border-amber-500/20 bg-amber-500/5 col-span-2 sm:col-span-1">
              <div className="text-xs font-medium text-amber-700 dark:text-amber-400">Early Dep.</div>
              <div className="mt-1 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                {summary.earlyDeparture}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-600/80">
                <LogOut className="size-3" /> Early leave
              </div>
            </Card>
          </div>

          {/* Multi-Filters Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search employee name, code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Branch Filter */}
              {branches.length > 1 && (
                <Select
                  value={branchFilter}
                  onValueChange={(val) => {
                    const b = val ?? 'ALL';
                    setBranchFilter(b);
                    setEmployeeFilter('ALL');
                    setShiftFilter('ALL');
                    refreshAttendance(dateFilter, b, 'ALL', 'ALL', statusFilter);
                  }}
                >
                  <SelectTrigger className="h-9 min-w-36" disabled={isPending}>
                    <SelectValue placeholder="All Branches" />
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
              )}

              {/* Employee Filter */}
              <Select
                value={employeeFilter}
                onValueChange={(val) => {
                  const e = val ?? 'ALL';
                  setEmployeeFilter(e);
                  refreshAttendance(dateFilter, branchFilter, e, shiftFilter, statusFilter);
                }}
              >
                <SelectTrigger className="h-9 min-w-36" disabled={isPending}>
                  <SelectValue placeholder="All Employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Employees</SelectItem>
                  {filterEmployees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.firstName} {e.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Shift Filter */}
              <Select
                value={shiftFilter}
                onValueChange={(val) => {
                  const s = val ?? 'ALL';
                  setShiftFilter(s);
                  refreshAttendance(dateFilter, branchFilter, employeeFilter, s, statusFilter);
                }}
              >
                <SelectTrigger className="h-9 min-w-32" disabled={isPending}>
                  <SelectValue placeholder="All Shifts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Shifts</SelectItem>
                  {filterShifts.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select
                value={statusFilter}
                onValueChange={(val) => {
                  const st = val ?? 'ALL';
                  setStatusFilter(st);
                  refreshAttendance(dateFilter, branchFilter, employeeFilter, shiftFilter, st);
                }}
              >
                <SelectTrigger className="h-9 min-w-32" disabled={isPending}>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Status</SelectItem>
                  <SelectItem value="PRESENT">Present</SelectItem>
                  <SelectItem value="HALF_DAY">Half Day</SelectItem>
                  <SelectItem value="ABSENT">Absent</SelectItem>
                  <SelectItem value="LEAVE">Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Attendance Table & List */}
          {isPending ? (
            <TableSkeleton columns={7} rows={6} />
          ) : filteredAttendance.length === 0 ? (
            <EmptyState
              title="No attendance records found"
              description={`No employee attendance has been recorded for ${formatDateDisplay(dateFilter)} matching your filters.`}
              action={
                canCreateAttendance
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
              {/* Desktop Table (Hidden on small screens) */}
              <div className="hidden md:block rounded-lg border bg-card shadow-xs overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Shift</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Check-In</TableHead>
                      <TableHead>Check-Out</TableHead>
                      <TableHead>Marked By</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAttendance.map((record) => {
                      const isCheckedInWithoutOut =
                        record.checkIn && !record.checkOut && record.status === 'PRESENT';

                      return (
                        <TableRow key={record.id}>
                          {/* Employee */}
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
                            <span className="text-sm">{record.branch.name}</span>
                            <span className="block text-xs text-muted-foreground">{record.branch.city}</span>
                          </TableCell>

                          {/* Shift */}
                          <TableCell>
                            {record.shift ? (
                              <div>
                                <span className="font-medium text-xs">{record.shift.name}</span>
                                <span className="block text-xs text-muted-foreground">
                                  {record.shift.startTime} - {record.shift.endTime}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Unassigned</span>
                            )}
                          </TableCell>

                          {/* Status */}
                          <TableCell>{renderStatusBadge(record.status)}</TableCell>

                          {/* Check-In */}
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs font-mono font-medium">
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
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs font-mono font-medium">
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

              {/* Mobile Card List (Visible on mobile/tablet) */}
              <div className="space-y-3 md:hidden">
                {filteredAttendance.map((record) => {
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
                          <span className="text-muted-foreground">Shift:</span>{' '}
                          <strong>{record.shift?.name ?? 'None'}</strong>
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

                      <div className="mt-3 flex items-center justify-between border-t pt-2.5 text-xs text-muted-foreground">
                        <span>Marked by: {record.markedBy ?? 'System'}</span>
                        <div className="flex items-center gap-1">
                          {isCheckedInWithoutOut && canUpdateAttendance && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs px-2 gap-1 border-amber-500/40 text-amber-700 dark:text-amber-400"
                              onClick={() =>
                                handleQuickCheckOut(
                                  record.id,
                                  `${record.employee.firstName} ${record.employee.lastName}`
                                )
                              }
                            >
                              <LogOut className="size-3" />
                              Check Out
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => router.push(`/attendance/${record.id}`)}
                          >
                            Details
                          </Button>
                          {canUpdateAttendance && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => {
                                setSelectedAttendance(record);
                                setAttendanceDialogOpen(true);
                              }}
                            >
                              Edit
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </TabsContent>

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* TAB 2: SHIFT SCHEDULES                                             */}
        {/* ────────────────────────────────────────────────────────────────── */}
        <TabsContent value="shifts" className="space-y-6 pt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Define operational work shifts for branch staff scheduling.
            </div>

            <div className="flex items-center gap-2">
              {branches.length > 1 && (
                <Select
                  value={shiftBranchFilter}
                  onValueChange={(val) => {
                    const b = val ?? 'ALL';
                    setShiftBranchFilter(b);
                    refreshShifts(b);
                  }}
                >
                  <SelectTrigger className="h-9 min-w-40" disabled={isPending}>
                    <SelectValue placeholder="All Branches" />
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
              )}

              {canCreateShift && (
                <Button
                  onClick={() => {
                    setSelectedShift(null);
                    setShiftDialogOpen(true);
                  }}
                  size="sm"
                >
                  <Plus className="mr-1.5 size-4" />
                  New Shift
                </Button>
              )}
            </div>
          </div>

          {shifts.length === 0 ? (
            <EmptyState
              title="No shifts defined"
              description="Create shifts to set standard working hours for employees."
              action={
                canCreateShift
                  ? {
                      label: 'Create Shift',
                      onClick: () => {
                        setSelectedShift(null);
                        setShiftDialogOpen(true);
                      },
                    }
                  : undefined
              }
            />
          ) : (
            <div className="rounded-lg border bg-card shadow-xs overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shift Name</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Scheduled Hours</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shifts.map((shift) => {
                    const durationStr = computeShiftHours(shift.startTime, shift.endTime);
                    const isOvernight = shift.endTime < shift.startTime;

                    return (
                      <TableRow key={shift.id}>
                        {/* Name */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {isOvernight ? (
                              <Moon className="size-4 text-indigo-500" />
                            ) : (
                              <Clock className="size-4 text-primary" />
                            )}
                            <span className="font-semibold text-foreground">{shift.name}</span>
                          </div>
                        </TableCell>

                        {/* Branch */}
                        <TableCell>
                          <span className="text-sm">{shift.branch.name}</span>
                          <span className="block text-xs text-muted-foreground">{shift.branch.city}</span>
                        </TableCell>

                        {/* Hours */}
                        <TableCell>
                          <span className="font-mono text-xs font-medium">
                            {shift.startTime} → {shift.endTime}
                          </span>
                        </TableCell>

                        {/* Duration */}
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{durationStr}</span>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          {shift.status === 'ACTIVE' ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              Inactive
                            </Badge>
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {canUpdateShift && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  setSelectedShift(shift);
                                  setShiftDialogOpen(true);
                                }}
                                title="Edit Shift"
                              >
                                <Pencil className="size-4 text-muted-foreground" />
                              </Button>
                            )}

                            {canDeactivateShift && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  setShiftToToggle(shift);
                                  setShiftStatusDialogOpen(true);
                                }}
                                title={shift.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                              >
                                <Power
                                  className={`size-4 ${
                                    shift.status === 'ACTIVE'
                                      ? 'text-muted-foreground hover:text-destructive'
                                      : 'text-emerald-600'
                                  }`}
                                />
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
          )}
        </TabsContent>
      </Tabs>

      {/* Attendance Form Dialog (Create / Edit) */}
      <AttendanceFormDialog
        open={attendanceDialogOpen}
        onOpenChange={setAttendanceDialogOpen}
        record={selectedAttendance}
        defaultDate={dateFilter}
        defaultBranchId={branchFilter}
        branches={branches}
        employees={employees}
        shifts={shifts}
        onSuccess={() => refreshAttendance()}
      />

      {/* Shift Form Dialog (Create / Edit) */}
      <ShiftFormDialog
        open={shiftDialogOpen}
        onOpenChange={setShiftDialogOpen}
        shift={selectedShift}
        branches={branches}
        onSuccess={() => refreshShifts()}
      />

      {/* Shift Status Dialog (Activate / Deactivate) */}
      {shiftToToggle && (
        <ShiftStatusDialog
          open={shiftStatusDialogOpen}
          onOpenChange={setShiftStatusDialogOpen}
          shift={shiftToToggle}
          onSuccess={() => refreshShifts()}
        />
      )}
    </div>
  );
}
