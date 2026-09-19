'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import {
  shiftSchema,
  updateShiftSchema,
  attendanceRecordSchema,
  attendanceUpdateSchema,
  type AttendanceFilterInput,
} from '@/lib/validations/attendance';
import type { ActionResult, AuthUser } from '@/lib/auth/types';
import type { AttendanceStatus, ShiftStatus } from '@prisma/client';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ShiftItem {
  id: string;
  name: string;
  branchId: string;
  startTime: string;
  endTime: string;
  status: ShiftStatus;
  createdAt: Date;
  updatedAt: Date;
  branch: {
    id: string;
    name: string;
    code: string;
    city: string;
  };
}

export interface AttendanceItem {
  id: string;
  employeeId: string;
  branchId: string;
  shiftId: string | null;
  date: Date;
  status: AttendanceStatus;
  checkIn: Date | null;
  checkOut: Date | null;
  lateMinutes: number;
  earlyDepartureMinutes: number;
  note: string | null;
  markedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
    designation: string;
  };
  branch: {
    id: string;
    name: string;
    code: string;
    city: string;
  };
  shift: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
  } | null;
}

export interface AttendanceSummary {
  date: string;
  totalEmployees: number;
  present: number;
  absent: number;
  halfDay: number;
  leave: number;
  late: number;
  earlyDeparture: number;
}

export interface AttendanceFormState extends ActionResult<AttendanceItem> {
  fieldErrors?: Record<string, string[]>;
}

export interface ShiftFormState extends ActionResult<ShiftItem> {
  fieldErrors?: Record<string, string[]>;
}

// ─── Branch Scoping Authorization Helper ────────────────────────────────────

/**
 * Resolves the authorized branch scope for the authenticated user.
 * OWNER and ADMIN have global access.
 * MANAGER is restricted to their assigned branch.
 */
async function getAuthorizedBranchScope(
  user: AuthUser
): Promise<{ isAllBranches: boolean; branchIds: string[] }> {
  if (user.role === 'OWNER' || user.role === 'ADMIN') {
    return { isAllBranches: true, branchIds: [] };
  }

  // Manager: look up linked Employee record
  const employee = await prisma.employee.findUnique({
    where: { userId: user.id },
    select: { branchId: true },
  });

  if (employee?.branchId) {
    return { isAllBranches: false, branchIds: [employee.branchId] };
  }

  return { isAllBranches: false, branchIds: [] };
}

// ─── Calculation Helpers ───────────────────────────────────────────────────

function parseDateOnly(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function combineDateAndTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

function calculateLateAndEarly(
  dateStr: string,
  checkIn: Date | null,
  checkOut: Date | null,
  shift: { startTime: string; endTime: string } | null
): { lateMinutes: number; earlyDepartureMinutes: number } {
  let lateMinutes = 0;
  let earlyDepartureMinutes = 0;

  if (!shift) {
    return { lateMinutes, earlyDepartureMinutes };
  }

  // Calculate Late Arrival
  if (checkIn) {
    const shiftStart = combineDateAndTime(dateStr, shift.startTime);
    if (checkIn.getTime() > shiftStart.getTime()) {
      lateMinutes = Math.max(
        0,
        Math.floor((checkIn.getTime() - shiftStart.getTime()) / 60000)
      );
    }
  }

  // Calculate Early Departure
  if (checkOut) {
    let shiftEnd = combineDateAndTime(dateStr, shift.endTime);
    // Overnight shift handling: if endTime is earlier than startTime, shift ends the next calendar day
    if (shift.endTime < shift.startTime) {
      shiftEnd = new Date(shiftEnd.getTime() + 24 * 60 * 60 * 1000);
    }

    if (checkOut.getTime() < shiftEnd.getTime()) {
      earlyDepartureMinutes = Math.max(
        0,
        Math.floor((shiftEnd.getTime() - checkOut.getTime()) / 60000)
      );
    }
  }

  return { lateMinutes, earlyDepartureMinutes };
}

// ─── Shift Operations ───────────────────────────────────────────────────────

/**
 * Fetches shifts filtered by branch (scoped to user's authorized branches).
 */
export async function getShifts(
  branchId?: string
): Promise<ActionResult<ShiftItem[]>> {
  try {
    const user = await requirePermission(PERMISSIONS.SHIFT_READ);
    const scope = await getAuthorizedBranchScope(user);

    const where: Record<string, unknown> = {};

    if (branchId && branchId !== 'ALL') {
      if (!scope.isAllBranches && !scope.branchIds.includes(branchId)) {
        return { success: false, error: 'Unauthorized branch access.' };
      }
      where.branchId = branchId;
    } else if (!scope.isAllBranches) {
      where.branchId = { in: scope.branchIds };
    }

    const shifts = await prisma.shift.findMany({
      where,
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
            city: true,
          },
        },
      },
      orderBy: [{ branch: { name: 'asc' } }, { startTime: 'asc' }],
    });

    return { success: true, data: shifts };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to fetch shifts:', error);
    return { success: false, error: 'Failed to load shifts.' };
  }
}

/**
 * Creates a new shift for a branch.
 */
export async function createShift(
  data: Record<string, unknown>
): Promise<ShiftFormState> {
  try {
    const user = await requirePermission(PERMISSIONS.SHIFT_CREATE);
    const scope = await getAuthorizedBranchScope(user);

    const parsed = shiftSchema.safeParse(data);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? '_form';
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return {
        success: false,
        error: 'Please fix the validation errors below.',
        fieldErrors,
      };
    }

    const input = parsed.data;

    if (!scope.isAllBranches && !scope.branchIds.includes(input.branchId)) {
      return { success: false, error: 'Unauthorized to create shifts for this branch.' };
    }

    // Check branch exists and is active
    const branch = await prisma.branch.findUnique({
      where: { id: input.branchId },
    });

    if (!branch) {
      return { success: false, error: 'Selected branch does not exist.' };
    }

    const shift = await prisma.shift.create({
      data: {
        name: input.name,
        branchId: input.branchId,
        startTime: input.startTime,
        endTime: input.endTime,
        status: input.status,
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
            city: true,
          },
        },
      },
    });

    revalidatePath('/attendance');
    return { success: true, data: shift };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to create shift:', error);
    return { success: false, error: 'Failed to create shift. Please try again.' };
  }
}

/**
 * Updates an existing shift.
 */
export async function updateShift(
  id: string,
  data: Record<string, unknown>
): Promise<ShiftFormState> {
  try {
    const user = await requirePermission(PERMISSIONS.SHIFT_UPDATE);
    const scope = await getAuthorizedBranchScope(user);

    const existing = await prisma.shift.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: 'Shift not found.' };
    }

    if (!scope.isAllBranches && !scope.branchIds.includes(existing.branchId)) {
      return { success: false, error: 'Unauthorized to modify this shift.' };
    }

    const parsed = updateShiftSchema.safeParse(data);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? '_form';
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return {
        success: false,
        error: 'Please fix the validation errors below.',
        fieldErrors,
      };
    }

    const input = parsed.data;

    const updated = await prisma.shift.update({
      where: { id },
      data: {
        name: input.name,
        branchId: input.branchId,
        startTime: input.startTime,
        endTime: input.endTime,
        status: input.status,
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
            city: true,
          },
        },
      },
    });

    revalidatePath('/attendance');
    return { success: true, data: updated };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to update shift:', error);
    return { success: false, error: 'Failed to update shift.' };
  }
}

/**
 * Toggles shift active/inactive status.
 */
export async function toggleShiftStatus(
  id: string
): Promise<ActionResult<ShiftItem>> {
  try {
    const user = await requirePermission(PERMISSIONS.SHIFT_DEACTIVATE);
    const scope = await getAuthorizedBranchScope(user);

    const existing = await prisma.shift.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: 'Shift not found.' };
    }

    if (!scope.isAllBranches && !scope.branchIds.includes(existing.branchId)) {
      return { success: false, error: 'Unauthorized to change this shift status.' };
    }

    const newStatus: ShiftStatus = existing.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    const updated = await prisma.shift.update({
      where: { id },
      data: { status: newStatus },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
            city: true,
          },
        },
      },
    });

    revalidatePath('/attendance');
    return { success: true, data: updated };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to toggle shift status:', error);
    return { success: false, error: 'Failed to update shift status.' };
  }
}

// ─── Attendance Operations ─────────────────────────────────────────────────

/**
 * Fetches attendance records filtered by date, branch, employee, shift, and status.
 */
export async function getAttendanceRecords(
  filters?: AttendanceFilterInput
): Promise<ActionResult<AttendanceItem[]>> {
  try {
    const user = await requirePermission(PERMISSIONS.ATTENDANCE_READ);
    const scope = await getAuthorizedBranchScope(user);

    const { date, branchId, employeeId, shiftId, status } = filters ?? {};

    const where: Record<string, unknown> = {};

    // Date filter: defaults to today if not provided
    const targetDate = date ? parseDateOnly(date) : parseDateOnly(new Date().toISOString().split('T')[0]);
    where.date = targetDate;

    // Branch scoping & filter
    if (branchId && branchId !== 'ALL') {
      if (!scope.isAllBranches && !scope.branchIds.includes(branchId)) {
        return { success: false, error: 'Unauthorized branch access.' };
      }
      where.branchId = branchId;
    } else if (!scope.isAllBranches) {
      where.branchId = { in: scope.branchIds };
    }

    // Employee filter
    if (employeeId && employeeId !== 'ALL') {
      where.employeeId = employeeId;
    }

    // Shift filter
    if (shiftId && shiftId !== 'ALL') {
      where.shiftId = shiftId;
    }

    // Status filter
    if (status && status !== 'ALL') {
      where.status = status;
    }

    const records = await prisma.attendance.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            designation: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
            city: true,
          },
        },
        shift: {
          select: {
            id: true,
            name: true,
            startTime: true,
            endTime: true,
          },
        },
      },
      orderBy: [{ employee: { firstName: 'asc' } }],
    });

    return { success: true, data: records };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to fetch attendance records:', error);
    return { success: false, error: 'Failed to load attendance records.' };
  }
}

/**
 * Fetches single attendance record by ID.
 */
export async function getAttendanceById(
  id: string
): Promise<ActionResult<AttendanceItem>> {
  try {
    const user = await requirePermission(PERMISSIONS.ATTENDANCE_READ);
    const scope = await getAuthorizedBranchScope(user);

    const record = await prisma.attendance.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            designation: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
            city: true,
          },
        },
        shift: {
          select: {
            id: true,
            name: true,
            startTime: true,
            endTime: true,
          },
        },
      },
    });

    if (!record) {
      return { success: false, error: 'Attendance record not found.' };
    }

    if (!scope.isAllBranches && !scope.branchIds.includes(record.branchId)) {
      return { success: false, error: 'Unauthorized to view this attendance record.' };
    }

    return { success: true, data: record };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to fetch attendance record:', error);
    return { success: false, error: 'Failed to load attendance record.' };
  }
}

/**
 * Fetches attendance summary statistics for a given date and branch scope.
 */
export async function getAttendanceSummary(
  dateStr?: string,
  branchId?: string
): Promise<ActionResult<AttendanceSummary>> {
  try {
    const user = await requirePermission(PERMISSIONS.ATTENDANCE_READ);
    const scope = await getAuthorizedBranchScope(user);

    const targetDate = dateStr
      ? parseDateOnly(dateStr)
      : parseDateOnly(new Date().toISOString().split('T')[0]);

    const branchFilter: Record<string, unknown> = {};
    if (branchId && branchId !== 'ALL') {
      if (!scope.isAllBranches && !scope.branchIds.includes(branchId)) {
        return { success: false, error: 'Unauthorized branch access.' };
      }
      branchFilter.branchId = branchId;
    } else if (!scope.isAllBranches) {
      branchFilter.branchId = { in: scope.branchIds };
    }

    const [totalEmployees, records] = await Promise.all([
      prisma.employee.count({
        where: {
          employmentStatus: 'ACTIVE',
          ...branchFilter,
        },
      }),
      prisma.attendance.findMany({
        where: {
          date: targetDate,
          ...branchFilter,
        },
        select: {
          status: true,
          lateMinutes: true,
          earlyDepartureMinutes: true,
        },
      }),
    ]);

    let present = 0;
    let absent = 0;
    let halfDay = 0;
    let leave = 0;
    let late = 0;
    let earlyDeparture = 0;

    for (const r of records) {
      if (r.status === 'PRESENT') present++;
      if (r.status === 'ABSENT') absent++;
      if (r.status === 'HALF_DAY') halfDay++;
      if (r.status === 'LEAVE') leave++;
      if (r.lateMinutes > 0) late++;
      if (r.earlyDepartureMinutes > 0) earlyDeparture++;
    }

    return {
      success: true,
      data: {
        date: dateStr || new Date().toISOString().split('T')[0],
        totalEmployees,
        present,
        absent,
        halfDay,
        leave,
        late,
        earlyDeparture,
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to fetch attendance summary:', error);
    return { success: false, error: 'Failed to calculate attendance summary.' };
  }
}

/**
 * Manually marks attendance for an employee.
 * Cross-validates that employee and shift belong to the specified branch.
 * Enforces single attendance record per employee per date.
 */
export async function markAttendance(
  data: Record<string, unknown>
): Promise<AttendanceFormState> {
  try {
    const user = await requirePermission(PERMISSIONS.ATTENDANCE_CREATE);
    const scope = await getAuthorizedBranchScope(user);

    const parsed = attendanceRecordSchema.safeParse(data);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? '_form';
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return {
        success: false,
        error: 'Please fix the validation errors below.',
        fieldErrors,
      };
    }

    const input = parsed.data;

    // Verify branch scope authorization
    if (!scope.isAllBranches && !scope.branchIds.includes(input.branchId)) {
      return { success: false, error: 'Unauthorized to record attendance for this branch.' };
    }

    // Cross-entity validation 1: Employee exists and belongs to branch
    const employee = await prisma.employee.findUnique({
      where: { id: input.employeeId },
      include: { branch: true },
    });

    if (!employee) {
      return { success: false, error: 'Selected employee does not exist.' };
    }

    if (employee.branchId !== input.branchId) {
      return {
        success: false,
        error: `Employee belongs to "${employee.branch.name}", not the selected branch.`,
      };
    }

    // Cross-entity validation 2: Shift exists and belongs to branch (if provided)
    let shift = null;
    if (input.shiftId) {
      shift = await prisma.shift.findUnique({
        where: { id: input.shiftId },
      });

      if (!shift) {
        return { success: false, error: 'Selected shift does not exist.' };
      }

      if (shift.branchId !== input.branchId) {
        return {
          success: false,
          error: 'The selected shift does not belong to this branch.',
        };
      }
    }

    // Normalize calendar date
    const dateObj = parseDateOnly(input.date);

    // Enforce Uniqueness: check if attendance already exists for this employee on this date
    const existing = await prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: input.employeeId,
          date: dateObj,
        },
      },
    });

    if (existing) {
      return {
        success: false,
        error: 'An attendance record already exists for this employee on this date. Please edit the existing record instead.',
      };
    }

    // Convert time strings to full Date objects
    let checkInDate: Date | null = null;
    let checkOutDate: Date | null = null;

    if (input.status === 'PRESENT' || input.status === 'HALF_DAY') {
      if (input.checkInTime) {
        checkInDate = combineDateAndTime(input.date, input.checkInTime);
      }
      if (input.checkOutTime) {
        checkOutDate = combineDateAndTime(input.date, input.checkOutTime);
        // Handle overnight shift: if checkOutTime is earlier than checkInTime, add 1 day to checkOut
        if (input.checkInTime && input.checkOutTime < input.checkInTime) {
          checkOutDate = new Date(checkOutDate.getTime() + 24 * 60 * 60 * 1000);
        }
      }
    }

    // Calculate late arrival and early departure minutes
    const { lateMinutes, earlyDepartureMinutes } = calculateLateAndEarly(
      input.date,
      checkInDate,
      checkOutDate,
      shift
    );

    const record = await prisma.attendance.create({
      data: {
        employeeId: input.employeeId,
        branchId: input.branchId,
        shiftId: input.shiftId || null,
        date: dateObj,
        status: input.status,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        lateMinutes,
        earlyDepartureMinutes,
        note: input.note || null,
        markedBy: user.name,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            designation: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
            city: true,
          },
        },
        shift: {
          select: {
            id: true,
            name: true,
            startTime: true,
            endTime: true,
          },
        },
      },
    });

    revalidatePath('/attendance');
    return { success: true, data: record };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to mark attendance:', error);
    return { success: false, error: 'Failed to record attendance. Please try again.' };
  }
}

/**
 * Updates or corrects an existing attendance record.
 */
export async function updateAttendance(
  id: string,
  data: Record<string, unknown>
): Promise<AttendanceFormState> {
  try {
    const user = await requirePermission(PERMISSIONS.ATTENDANCE_UPDATE);
    const scope = await getAuthorizedBranchScope(user);

    const existing = await prisma.attendance.findUnique({
      where: { id },
      include: { employee: true, branch: true },
    });

    if (!existing) {
      return { success: false, error: 'Attendance record not found.' };
    }

    if (!scope.isAllBranches && !scope.branchIds.includes(existing.branchId)) {
      return { success: false, error: 'Unauthorized to update this attendance record.' };
    }

    const parsed = attendanceUpdateSchema.safeParse(data);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? '_form';
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return {
        success: false,
        error: 'Please fix the validation errors below.',
        fieldErrors,
      };
    }

    const input = parsed.data;

    // Cross-entity check for shift if modified
    let shift = null;
    const targetShiftId = input.shiftId !== undefined ? input.shiftId : existing.shiftId;
    if (targetShiftId) {
      shift = await prisma.shift.findUnique({ where: { id: targetShiftId } });
      if (!shift || shift.branchId !== existing.branchId) {
        return { success: false, error: 'Selected shift does not belong to this branch.' };
      }
    }

    const dateStr = existing.date.toISOString().split('T')[0];

    // Compute timestamps
    let checkInDate: Date | null = null;
    let checkOutDate: Date | null = null;

    if (input.status === 'PRESENT' || input.status === 'HALF_DAY') {
      if (input.checkInTime) {
        checkInDate = combineDateAndTime(dateStr, input.checkInTime);
      }
      if (input.checkOutTime) {
        checkOutDate = combineDateAndTime(dateStr, input.checkOutTime);
        if (input.checkInTime && input.checkOutTime < input.checkInTime) {
          checkOutDate = new Date(checkOutDate.getTime() + 24 * 60 * 60 * 1000);
        }
      }
    }

    const { lateMinutes, earlyDepartureMinutes } = calculateLateAndEarly(
      dateStr,
      checkInDate,
      checkOutDate,
      shift
    );

    const updated = await prisma.attendance.update({
      where: { id },
      data: {
        shiftId: targetShiftId || null,
        status: input.status,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        lateMinutes,
        earlyDepartureMinutes,
        note: input.note !== undefined ? (input.note || null) : existing.note,
        markedBy: `${user.name} (Updated)`,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            designation: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
            city: true,
          },
        },
        shift: {
          select: {
            id: true,
            name: true,
            startTime: true,
            endTime: true,
          },
        },
      },
    });

    revalidatePath('/attendance');
    revalidatePath(`/attendance/${id}`);
    return { success: true, data: updated };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to update attendance record:', error);
    return { success: false, error: 'Failed to update attendance record.' };
  }
}

/**
 * 1-click Quick Check-In for current date and time.
 */
export async function quickCheckIn(
  employeeId: string,
  shiftId?: string
): Promise<ActionResult<AttendanceItem>> {
  try {
    const user = await requirePermission(PERMISSIONS.ATTENDANCE_CREATE);
    const scope = await getAuthorizedBranchScope(user);

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { currentShift: true, branch: true },
    });

    if (!employee) {
      return { success: false, error: 'Employee not found.' };
    }

    if (!scope.isAllBranches && !scope.branchIds.includes(employee.branchId)) {
      return { success: false, error: 'Unauthorized to check in staff for this branch.' };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const today = parseDateOnly(todayStr);
    const now = new Date();

    const targetShiftId = shiftId || employee.currentShiftId || null;
    let shift = null;
    if (targetShiftId) {
      shift = await prisma.shift.findUnique({ where: { id: targetShiftId } });
    }

    const { lateMinutes } = calculateLateAndEarly(todayStr, now, null, shift);

    const record = await prisma.attendance.upsert({
      where: {
        employeeId_date: {
          employeeId,
          date: today,
        },
      },
      update: {
        checkIn: now,
        status: 'PRESENT',
        shiftId: targetShiftId,
        lateMinutes,
        markedBy: user.name,
      },
      create: {
        employeeId,
        branchId: employee.branchId,
        shiftId: targetShiftId,
        date: today,
        status: 'PRESENT',
        checkIn: now,
        checkOut: null,
        lateMinutes,
        earlyDepartureMinutes: 0,
        markedBy: user.name,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            designation: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
            city: true,
          },
        },
        shift: {
          select: {
            id: true,
            name: true,
            startTime: true,
            endTime: true,
          },
        },
      },
    });

    revalidatePath('/attendance');
    return { success: true, data: record };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to quick check-in:', error);
    return { success: false, error: 'Failed to record check-in.' };
  }
}

/**
 * 1-click Quick Check-Out for existing attendance record.
 */
export async function quickCheckOut(
  attendanceId: string
): Promise<ActionResult<AttendanceItem>> {
  try {
    const user = await requirePermission(PERMISSIONS.ATTENDANCE_UPDATE);
    const scope = await getAuthorizedBranchScope(user);

    const attendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: { shift: true },
    });

    if (!attendance) {
      return { success: false, error: 'Attendance record not found.' };
    }

    if (!scope.isAllBranches && !scope.branchIds.includes(attendance.branchId)) {
      return { success: false, error: 'Unauthorized to update this attendance record.' };
    }

    const dateStr = attendance.date.toISOString().split('T')[0];
    const now = new Date();

    const { earlyDepartureMinutes } = calculateLateAndEarly(
      dateStr,
      attendance.checkIn,
      now,
      attendance.shift
    );

    const record = await prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        checkOut: now,
        earlyDepartureMinutes,
        markedBy: `${user.name} (Check-out)`,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            designation: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
            city: true,
          },
        },
        shift: {
          select: {
            id: true,
            name: true,
            startTime: true,
            endTime: true,
          },
        },
      },
    });

    revalidatePath('/attendance');
    revalidatePath(`/attendance/${attendanceId}`);
    return { success: true, data: record };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to quick check-out:', error);
    return { success: false, error: 'Failed to record check-out.' };
  }
}

// ─── Auxiliary Helpers ──────────────────────────────────────────────────────

/**
 * Returns active branches authorized for the current user.
 */
export async function getAuthorizedBranches(): Promise<
  ActionResult<Array<{ id: string; name: string; code: string; city: string }>>
> {
  try {
    const user = await requirePermission(PERMISSIONS.ATTENDANCE_READ);
    const scope = await getAuthorizedBranchScope(user);

    const where: Record<string, unknown> = { status: 'ACTIVE' };
    if (!scope.isAllBranches) {
      where.id = { in: scope.branchIds };
    }

    const branches = await prisma.branch.findMany({
      where,
      select: { id: true, name: true, code: true, city: true },
      orderBy: { name: 'asc' },
    });

    return { success: true, data: branches };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to load authorized branches:', error);
    return { success: false, error: 'Failed to load branches.' };
  }
}

/**
 * Returns active employees belonging to authorized branch(es).
 */
export async function getAuthorizedEmployees(
  branchId?: string
): Promise<
  ActionResult<
    Array<{
      id: string;
      firstName: string;
      lastName: string;
      employeeCode: string;
      designation: string;
      branchId: string;
      currentShiftId: string | null;
    }>
  >
> {
  try {
    const user = await requirePermission(PERMISSIONS.ATTENDANCE_READ);
    const scope = await getAuthorizedBranchScope(user);

    const where: Record<string, unknown> = { employmentStatus: 'ACTIVE' };
    if (branchId && branchId !== 'ALL') {
      if (!scope.isAllBranches && !scope.branchIds.includes(branchId)) {
        return { success: false, error: 'Unauthorized branch.' };
      }
      where.branchId = branchId;
    } else if (!scope.isAllBranches) {
      where.branchId = { in: scope.branchIds };
    }

    const employees = await prisma.employee.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        designation: true,
        branchId: true,
        currentShiftId: true,
      },
      orderBy: { firstName: 'asc' },
    });

    return { success: true, data: employees };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to load employees for attendance:', error);
    return { success: false, error: 'Failed to load employees.' };
  }
}

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as Record<string, unknown>).digest === 'string' &&
    ((error as Record<string, string>).digest.startsWith('NEXT_REDIRECT') ||
      (error as Record<string, string>).digest === 'DYNAMIC_SERVER_USAGE')
  );
}
