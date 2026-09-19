'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User,
  Pencil,
  LogOut,
  FileText,
  History,
} from 'lucide-react';

import { type AttendanceItem, type ShiftItem } from '@/lib/attendance/actions';
import { useAuth } from '@/providers/auth-provider';
import { hasPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AttendanceFormDialog, type BranchOption, type EmployeeOption } from '@/components/attendance/attendance-form-dialog';

// ─── Props ──────────────────────────────────────────────────────────────────

interface AttendanceDetailClientProps {
  record: AttendanceItem;
  branches: BranchOption[];
  employees: EmployeeOption[];
  shifts: ShiftItem[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatFullDateTime(date: Date | string | null): string {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDateDisplay(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTimeOnly(date: Date | string | null): string {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AttendanceDetailClient({
  record,
  branches,
  employees,
  shifts,
}: AttendanceDetailClientProps) {
  const router = useRouter();
  const user = useAuth();
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const canUpdate = hasPermission(user, PERMISSIONS.ATTENDANCE_UPDATE);

  const renderStatusBadge = (status: AttendanceItem['status']) => {
    switch (status) {
      case 'PRESENT':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 text-sm font-medium px-2.5 py-1">
            <CheckCircle2 className="size-4" />
            Present (Full Day)
          </Badge>
        );
      case 'ABSENT':
        return (
          <Badge variant="destructive" className="gap-1 text-sm font-medium px-2.5 py-1">
            <XCircle className="size-4" />
            Absent
          </Badge>
        );
      case 'HALF_DAY':
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1 text-sm font-medium px-2.5 py-1">
            <Clock className="size-4" />
            Half Day
          </Badge>
        );
      case 'LEAVE':
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 gap-1 text-sm font-medium px-2.5 py-1">
            <Calendar className="size-4" />
            Approved Leave
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Back button and Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="size-8 p-0"
            onClick={() => router.push('/attendance')}
            title="Back to Attendance"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Attendance Record
            </h1>
            <p className="text-sm text-muted-foreground">
              {record.employee.firstName} {record.employee.lastName} • {formatDateDisplay(record.date)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canUpdate && (
            <Button onClick={() => setEditDialogOpen(true)} size="sm">
              <Pencil className="mr-1.5 size-4" />
              Correct Record
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Left Column: Employee & Status Overview */}
        <div className="space-y-6 md:col-span-1">
          {/* Employee Card */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <User className="size-4" />
                Employee Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary">
                  {record.employee.firstName[0]}
                  {record.employee.lastName[0]}
                </div>
                <div className="min-w-0">
                  <div className="text-base font-semibold text-foreground truncate">
                    {record.employee.firstName} {record.employee.lastName}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {record.employee.employeeCode}
                  </div>
                </div>
              </div>

              <div className="space-y-2 border-t pt-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Designation:</span>
                  <span className="font-medium text-foreground">{record.employee.designation}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Branch:</span>
                  <span className="font-medium text-foreground">{record.branch.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">City:</span>
                  <span className="font-medium text-foreground">{record.branch.city}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Audit & Compliance Card */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <History className="size-4" />
                Audit Trail
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground block">Marked / Handled By</span>
                <span className="font-medium text-foreground">{record.markedBy ?? 'System'}</span>
              </div>
              <div className="border-t pt-2">
                <span className="text-xs text-muted-foreground block">Created At</span>
                <span className="font-medium text-foreground text-xs">{formatFullDateTime(record.createdAt)}</span>
              </div>
              <div className="border-t pt-2">
                <span className="text-xs text-muted-foreground block">Last Modified At</span>
                <span className="font-medium text-foreground text-xs">{formatFullDateTime(record.updatedAt)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Attendance Details, Working Hours & Calculations */}
        <div className="space-y-6 md:col-span-2">
          {/* Status & Schedule Card */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="size-4" />
                  Attendance Summary
                </CardTitle>
                <div>{renderStatusBadge(record.status)}</div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Scheduled Shift Info */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-primary" />
                    <span className="font-semibold text-foreground">
                      {record.shift ? record.shift.name : 'No Scheduled Shift'}
                    </span>
                  </div>
                  {record.shift && (
                    <Badge variant="outline" className="font-mono text-xs">
                      {record.shift.startTime} — {record.shift.endTime}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Working Hours & Timing Grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Check-In */}
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Recorded Check-In
                  </div>
                  <div className="text-xl font-bold font-mono text-foreground">
                    {formatTimeOnly(record.checkIn)}
                  </div>
                  {record.lateMinutes > 0 ? (
                    <Badge variant="destructive" className="font-mono text-xs gap-1">
                      <AlertTriangle className="size-3" />
                      Late Arrival: {record.lateMinutes} minutes
                    </Badge>
                  ) : record.checkIn ? (
                    <Badge variant="outline" className="text-green-600 border-green-200 dark:border-green-900 font-mono text-xs">
                      On-Time Check-In
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">No check-in recorded</span>
                  )}
                </div>

                {/* Check-Out */}
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Recorded Check-Out
                  </div>
                  <div className="text-xl font-bold font-mono text-foreground">
                    {formatTimeOnly(record.checkOut)}
                  </div>
                  {record.earlyDepartureMinutes > 0 ? (
                    <Badge className="bg-amber-600 hover:bg-amber-700 font-mono text-xs gap-1">
                      <LogOut className="size-3" />
                      Early Departure: {record.earlyDepartureMinutes} minutes
                    </Badge>
                  ) : record.checkOut ? (
                    <Badge variant="outline" className="text-green-600 border-green-200 dark:border-green-900 font-mono text-xs">
                      Normal Departure
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">No check-out recorded</span>
                  )}
                </div>
              </div>

              {/* Operational Notes / Remarks */}
              <div className="space-y-1.5 border-t pt-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FileText className="size-3.5" />
                  Notes & Remarks
                </div>
                <div className="rounded-md border bg-card p-3 text-sm text-foreground">
                  {record.note ? record.note : <span className="text-muted-foreground italic">No remarks recorded.</span>}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Form Dialog */}
      <AttendanceFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        record={record}
        branches={branches}
        employees={employees}
        shifts={shifts}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </div>
  );
}
