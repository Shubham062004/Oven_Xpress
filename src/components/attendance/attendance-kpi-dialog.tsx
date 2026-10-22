'use client';

import { useState, useMemo } from 'react';
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  AlertTriangle,
  LogOut,
  Search,
  Eye,
  Building2,
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import type { AttendanceItem } from '@/lib/attendance/actions';
import type { BranchOption, EmployeeOption } from '@/components/attendance/attendance-form-dialog';

export type KpiType =
  | 'active'
  | 'present'
  | 'absent'
  | 'halfDay'
  | 'leave'
  | 'late'
  | 'earlyDeparture'
  | null;

interface AttendanceKpiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kpiType: KpiType;
  dateStr: string;
  attendanceRecords: AttendanceItem[];
  activeEmployees: EmployeeOption[];
  branches: BranchOption[];
  onViewRecord?: (recordId: string) => void;
}

function formatTime(date: Date | string | null): string {
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

export function AttendanceKpiDialog({
  open,
  onOpenChange,
  kpiType,
  dateStr,
  attendanceRecords,
  activeEmployees,
  branches,
  onViewRecord,
}: AttendanceKpiDialogProps) {
  const [modalSearch, setModalSearch] = useState('');

  // Branch map for quick lookup
  const branchMap = useMemo(() => {
    const map = new Map<string, BranchOption>();
    for (const b of branches) {
      map.set(b.id, b);
    }
    return map;
  }, [branches]);

  // Attendance map by employeeId
  const attendanceMap = useMemo(() => {
    const map = new Map<string, AttendanceItem>();
    for (const r of attendanceRecords) {
      map.set(r.employeeId, r);
    }
    return map;
  }, [attendanceRecords]);

  // Derive configuration and matching items for the current KPI
  const { title, description, icon: Icon, items, badgeColor } = useMemo(() => {
    switch (kpiType) {
      case 'active': {
        const list = activeEmployees.map((emp) => {
          const rec = attendanceMap.get(emp.id);
          const br = emp.branchId ? branchMap.get(emp.branchId) : undefined;
          return {
            id: emp.id,
            recordId: rec?.id,
            firstName: emp.firstName,
            lastName: emp.lastName,
            employeeCode: emp.employeeCode,
            designation: emp.designation,
            branchName: br?.name ?? 'Unassigned',
            branchCity: br?.city ?? '',
            status: rec?.status,
            checkIn: rec?.checkIn ?? null,
            checkOut: rec?.checkOut ?? null,
            lateMinutes: rec?.lateMinutes ?? 0,
            earlyDepartureMinutes: rec?.earlyDepartureMinutes ?? 0,
            note: rec?.note ?? null,
          };
        });
        return {
          title: 'Active Staff',
          description: `All active employees in authorized scope on ${formatDateDisplay(dateStr)}.`,
          icon: Users,
          badgeColor: 'text-foreground',
          items: list,
        };
      }

      case 'present': {
        const list = attendanceRecords
          .filter((r) => r.status === 'PRESENT')
          .map((r) => ({
            id: r.employee.id,
            recordId: r.id,
            firstName: r.employee.firstName,
            lastName: r.employee.lastName,
            employeeCode: r.employee.employeeCode,
            designation: r.employee.designation,
            branchName: r.branch.name,
            branchCity: r.branch.city,
            status: r.status,
            checkIn: r.checkIn,
            checkOut: r.checkOut,
            lateMinutes: r.lateMinutes,
            earlyDepartureMinutes: r.earlyDepartureMinutes,
            note: r.note,
          }));
        return {
          title: 'Present Employees',
          description: `Staff members marked present for ${formatDateDisplay(dateStr)}.`,
          icon: CheckCircle2,
          badgeColor: 'text-emerald-600 dark:text-emerald-400',
          items: list,
        };
      }

      case 'absent': {
        const list = attendanceRecords
          .filter((r) => r.status === 'ABSENT')
          .map((r) => ({
            id: r.employee.id,
            recordId: r.id,
            firstName: r.employee.firstName,
            lastName: r.employee.lastName,
            employeeCode: r.employee.employeeCode,
            designation: r.employee.designation,
            branchName: r.branch.name,
            branchCity: r.branch.city,
            status: r.status,
            checkIn: null,
            checkOut: null,
            lateMinutes: 0,
            earlyDepartureMinutes: 0,
            note: r.note,
          }));
        return {
          title: 'Absent Employees',
          description: `Staff members recorded absent for ${formatDateDisplay(dateStr)}.`,
          icon: XCircle,
          badgeColor: 'text-destructive',
          items: list,
        };
      }

      case 'halfDay': {
        const list = attendanceRecords
          .filter((r) => r.status === 'HALF_DAY')
          .map((r) => ({
            id: r.employee.id,
            recordId: r.id,
            firstName: r.employee.firstName,
            lastName: r.employee.lastName,
            employeeCode: r.employee.employeeCode,
            designation: r.employee.designation,
            branchName: r.branch.name,
            branchCity: r.branch.city,
            status: r.status,
            checkIn: r.checkIn,
            checkOut: r.checkOut,
            lateMinutes: r.lateMinutes,
            earlyDepartureMinutes: r.earlyDepartureMinutes,
            note: r.note,
          }));
        return {
          title: 'Half Day Employees',
          description: `Staff members who worked half-day for ${formatDateDisplay(dateStr)}.`,
          icon: Clock,
          badgeColor: 'text-amber-600 dark:text-amber-400',
          items: list,
        };
      }

      case 'leave': {
        const list = attendanceRecords
          .filter((r) => r.status === 'LEAVE')
          .map((r) => ({
            id: r.employee.id,
            recordId: r.id,
            firstName: r.employee.firstName,
            lastName: r.employee.lastName,
            employeeCode: r.employee.employeeCode,
            designation: r.employee.designation,
            branchName: r.branch.name,
            branchCity: r.branch.city,
            status: r.status,
            checkIn: null,
            checkOut: null,
            lateMinutes: 0,
            earlyDepartureMinutes: 0,
            note: r.note,
          }));
        return {
          title: 'Employees on Leave',
          description: `Staff members on approved leave for ${formatDateDisplay(dateStr)}.`,
          icon: Calendar,
          badgeColor: 'text-blue-600 dark:text-blue-400',
          items: list,
        };
      }

      case 'late': {
        const list = attendanceRecords
          .filter((r) => r.lateMinutes > 0)
          .map((r) => ({
            id: r.employee.id,
            recordId: r.id,
            firstName: r.employee.firstName,
            lastName: r.employee.lastName,
            employeeCode: r.employee.employeeCode,
            designation: r.employee.designation,
            branchName: r.branch.name,
            branchCity: r.branch.city,
            status: r.status,
            checkIn: r.checkIn,
            checkOut: r.checkOut,
            lateMinutes: r.lateMinutes,
            earlyDepartureMinutes: r.earlyDepartureMinutes,
            note: r.note,
          }));
        return {
          title: 'Late Arrivals',
          description: `Staff members who checked in after scheduled start on ${formatDateDisplay(dateStr)}.`,
          icon: AlertTriangle,
          badgeColor: 'text-orange-600 dark:text-orange-400',
          items: list,
        };
      }

      case 'earlyDeparture': {
        const list = attendanceRecords
          .filter((r) => r.earlyDepartureMinutes > 0)
          .map((r) => ({
            id: r.employee.id,
            recordId: r.id,
            firstName: r.employee.firstName,
            lastName: r.employee.lastName,
            employeeCode: r.employee.employeeCode,
            designation: r.employee.designation,
            branchName: r.branch.name,
            branchCity: r.branch.city,
            status: r.status,
            checkIn: r.checkIn,
            checkOut: r.checkOut,
            lateMinutes: r.lateMinutes,
            earlyDepartureMinutes: r.earlyDepartureMinutes,
            note: r.note,
          }));
        return {
          title: 'Early Departures',
          description: `Staff members who departed before shift completion on ${formatDateDisplay(dateStr)}.`,
          icon: LogOut,
          badgeColor: 'text-amber-600 dark:text-amber-400',
          items: list,
        };
      }

      default:
        return {
          title: 'Employees',
          description: '',
          icon: Users,
          badgeColor: 'text-foreground',
          items: [],
        };
    }
  }, [kpiType, dateStr, activeEmployees, attendanceRecords, attendanceMap, branchMap]);

  // Modal in-list search filter
  const filteredItems = useMemo(() => {
    if (!modalSearch.trim()) return items;
    const q = modalSearch.toLowerCase().trim();
    return items.filter(
      (it) =>
        it.firstName.toLowerCase().includes(q) ||
        it.lastName.toLowerCase().includes(q) ||
        it.employeeCode.toLowerCase().includes(q) ||
        it.designation.toLowerCase().includes(q) ||
        it.branchName.toLowerCase().includes(q)
    );
  }, [items, modalSearch]);

  const renderStatusBadge = (status?: string) => {
    switch (status) {
      case 'PRESENT':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0 font-medium">
            Present
          </Badge>
        );
      case 'ABSENT':
        return (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 font-medium">
            Absent
          </Badge>
        );
      case 'HALF_DAY':
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] px-1.5 py-0 font-medium">
            Half Day
          </Badge>
        );
      case 'LEAVE':
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[10px] px-1.5 py-0 font-medium">
            Leave
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground text-[10px] px-1.5 py-0 font-normal">
            Not Recorded
          </Badge>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] sm:max-w-2xl flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 pb-3 border-b">
          <div className="flex items-center gap-3">
            <div className={`flex size-10 items-center justify-center rounded-lg bg-muted ${badgeColor} shrink-0`}>
              <Icon className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
                <Badge variant="secondary" className="font-mono text-xs font-semibold">
                  {modalSearch.trim() ? `${filteredItems.length} of ${items.length}` : items.length}
                </Badge>
              </div>
              <DialogDescription className="text-xs mt-0.5">{description}</DialogDescription>
            </div>
          </div>

          {/* Quick in-modal search */}
          {items.length > 5 && (
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filter by name, code, designation, or branch..."
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          )}
        </DialogHeader>

        {/* Scrollable Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredItems.length === 0 ? (
            <EmptyState
              icon={Icon}
              title={modalSearch ? 'No matching employees' : `No ${title.toLowerCase()}`}
              description={
                modalSearch
                  ? `No employees matched "${modalSearch}".`
                  : `There are no employees recorded under ${title.toLowerCase()} for ${formatDateDisplay(dateStr)}.`
              }
            />
          ) : (
            <div className="space-y-2">
              {filteredItems.map((emp) => (
                <div
                  key={emp.id}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 shadow-2xs hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {emp.firstName[0]}
                      {emp.lastName[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground truncate">
                          {emp.firstName} {emp.lastName}
                        </span>
                        <Badge variant="outline" className="font-mono text-[10px] px-1 py-0 shrink-0">
                          {emp.employeeCode}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 truncate">
                        <span>{emp.designation}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Building2 className="size-3" />
                          {emp.branchName}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status & Times */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {renderStatusBadge(emp.status)}
                        {emp.lateMinutes > 0 && (
                          <Badge variant="destructive" className="font-mono text-[10px] px-1 py-0">
                            +{emp.lateMinutes}m
                          </Badge>
                        )}
                        {emp.earlyDepartureMinutes > 0 && (
                          <Badge className="bg-amber-600 hover:bg-amber-700 font-mono text-[10px] px-1 py-0">
                            -{emp.earlyDepartureMinutes}m
                          </Badge>
                        )}
                      </div>
                      {(emp.checkIn || emp.checkOut) && (
                        <div className="font-mono text-[11px] text-muted-foreground mt-0.5">
                          {formatTime(emp.checkIn)} → {formatTime(emp.checkOut)}
                        </div>
                      )}
                      {emp.note && !emp.checkIn && !emp.checkOut && (
                        <div className="text-[11px] text-muted-foreground max-w-35 truncate" title={emp.note}>
                          {emp.note}
                        </div>
                      )}
                    </div>

                    {/* View Attendance Detail Action */}
                    {emp.recordId && onViewRecord && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          onOpenChange(false);
                          onViewRecord(emp.recordId!);
                        }}
                        title="View Attendance Details"
                        aria-label={`View attendance for ${emp.firstName} ${emp.lastName}`}
                      >
                        <Eye className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t bg-muted/20">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
