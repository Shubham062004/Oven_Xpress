'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  CalendarDays,
  Search,
  AlertCircle,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ReportViewContainer, type SummaryCardItem } from './report-view-container';
import { formatNumber } from '@/lib/reports/constants';
import type { AttendanceReportRow, AttendanceReportSummary, PaginationMeta, DateRangePreset } from '@/lib/reports/types';
import { exportAttendanceReportCSVAction } from '@/lib/reports/actions';

interface AttendanceReportClientProps {
  rows: AttendanceReportRow[];
  summary: AttendanceReportSummary;
  pagination: PaginationMeta;
  branches: Array<{ id: string; name: string; code: string }>;
  shifts: Array<{ id: string; name: string }>;
  selectedBranchId: string;
  isBranchRestricted: boolean;
  selectedPreset: string;
  startDate?: string;
  endDate?: string;
  currentShift?: string;
  currentStatus?: string;
  currentSearch?: string;
}

export function AttendanceReportClient({
  rows,
  summary,
  pagination,
  branches,
  shifts,
  selectedBranchId,
  isBranchRestricted,
  selectedPreset,
  startDate,
  endDate,
  currentShift = 'all',
  currentStatus = 'all',
  currentSearch = '',
}: AttendanceReportClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(currentSearch);

  const handleFilterChange = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (value === 'all' || !value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.set('page', '1');
    router.push(`/reports/attendance?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleFilterChange('search', search);
  };

  const attendanceRate = summary.totalRecords > 0
    ? Math.round((summary.presentCount / summary.totalRecords) * 100)
    : 0;

  const summaryCards: SummaryCardItem[] = [
    {
      title: 'Total Shift Records',
      value: formatNumber(summary.totalRecords),
      subtitle: `${attendanceRate}% overall attendance rate`,
      icon: <Users className="w-4 h-4" />,
    },
    {
      title: 'Present & Active',
      value: formatNumber(summary.presentCount),
      subtitle: `${summary.halfDayCount} half-day shifts recorded`,
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    },
    {
      title: 'Absences & Leaves',
      value: formatNumber(summary.absentCount + summary.leaveCount),
      subtitle: `${summary.absentCount} unexcused / ${summary.leaveCount} approved leaves`,
      icon: <AlertCircle className="w-4 h-4 text-rose-500" />,
    },
    {
      title: 'Punctuality Exceptions',
      value: formatNumber(summary.lateArrivalsCount + summary.earlyDeparturesCount),
      subtitle: `${summary.lateArrivalsCount} late / ${summary.earlyDeparturesCount} early departure`,
      icon: <Clock className="w-4 h-4 text-amber-500" />,
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Present
          </Badge>
        );
      case 'HALF_DAY':
        return (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
            Half Day
          </Badge>
        );
      case 'ON_LEAVE':
        return (
          <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
            On Leave
          </Badge>
        );
      case 'ABSENT':
        return (
          <Badge variant="destructive">
            Absent
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleExport = async () => {
    const res = await exportAttendanceReportCSVAction({
      branchId: selectedBranchId,
      preset: selectedPreset as DateRangePreset,
      startDate,
      endDate,
      shiftId: currentShift === 'all' ? undefined : currentShift,
      status: currentStatus === 'all' ? undefined : currentStatus,
      search: currentSearch || undefined,
    });
    if (!res.success || !res.csv) throw new Error(res.error || 'Failed to export CSV');
    return res.csv;
  };

  return (
    <ReportViewContainer
      title="Attendance & Punctuality Report"
      description="Operational shift attendance records, arrival punctuality, and checkout deviations."
      branches={branches}
      selectedBranchId={selectedBranchId}
      isBranchRestricted={isBranchRestricted}
      selectedPreset={selectedPreset}
      startDate={startDate}
      endDate={endDate}
      summaryCards={summaryCards}
      pagination={pagination}
      onExportCSV={handleExport}
      extraFilters={
        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search employee, code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </form>

          <Select
            value={currentShift}
            onValueChange={(val) => handleFilterChange('shiftId', val)}
          >
            <SelectTrigger className="w-[160px] h-9 text-xs">
              <SelectValue placeholder="All Shifts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Shifts</SelectItem>
              {shifts.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={currentStatus}
            onValueChange={(val) => handleFilterChange('status', val)}
          >
            <SelectTrigger className="w-[140px] h-9 text-xs">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="PRESENT">Present</SelectItem>
              <SelectItem value="ABSENT">Absent</SelectItem>
              <SelectItem value="HALF_DAY">Half Day</SelectItem>
              <SelectItem value="ON_LEAVE">On Leave</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
    >
      <Card className="border shadow-xs">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold text-xs">Date</TableHead>
                  <TableHead className="font-semibold text-xs">Employee</TableHead>
                  <TableHead className="font-semibold text-xs">Branch</TableHead>
                  <TableHead className="font-semibold text-xs">Shift</TableHead>
                  <TableHead className="font-semibold text-xs">Status</TableHead>
                  <TableHead className="font-semibold text-xs">Check In</TableHead>
                  <TableHead className="font-semibold text-xs">Check Out</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Late (min)</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Early Exit (min)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-36 text-center text-muted-foreground text-sm">
                      No attendance records found matching the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id} className="hover:bg-muted/30">
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(row.date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium text-foreground">{row.employeeName}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {row.employeeCode} • {row.designation}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-foreground">
                        {row.branchName}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.shiftName}
                      </TableCell>
                      <TableCell className="text-xs">{getStatusBadge(row.status)}</TableCell>
                      <TableCell className="text-xs font-mono">
                        {row.checkInTime
                          ? new Date(row.checkInTime).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {row.checkOutTime
                          ? new Date(row.checkOutTime).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-right">
                        {row.lateMinutes > 0 ? (
                          <span className="font-mono text-amber-600 dark:text-amber-400 font-medium">
                            +{row.lateMinutes}m
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-right">
                        {row.earlyDepartureMinutes > 0 ? (
                          <span className="font-mono text-amber-600 dark:text-amber-400 font-medium">
                            -{row.earlyDepartureMinutes}m
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </ReportViewContainer>
  );
}
