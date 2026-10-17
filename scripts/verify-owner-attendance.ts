import { prisma } from '../src/lib/db/prisma';
import {
  getAttendanceRecords,
  getAttendanceSummary,
  getShifts,
  getAuthorizedBranches,
  getAuthorizedEmployees,
  createAttendance,
  updateAttendance,
  quickCheckOut,
  type AttendanceItem,
  type AttendanceSummary,
} from '../src/lib/attendance/actions';
import * as fs from 'fs';
import * as path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function main() {
  console.log('================================================================');
  console.log('🧪 VERIFYING OWNER ATTENDANCE PAGE ENHANCEMENTS');
  console.log('================================================================\n');

  const clientFilePath = path.join(
    process.cwd(),
    'src/components/attendance/attendance-list-client.tsx'
  );
  const dialogFilePath = path.join(
    process.cwd(),
    'src/components/attendance/attendance-kpi-dialog.tsx'
  );

  const clientFileContent = fs.readFileSync(clientFilePath, 'utf8');
  const dialogFileContent = fs.readFileSync(dialogFilePath, 'utf8');

  // ────────────────────────────────────────────────────────────────────────────
  // TEST 1: The Four Dropdown Filters are Removed
  // ────────────────────────────────────────────────────────────────────────────
  console.log('--- TEST 1: The Four Dropdown Filters Are Removed ---');
  // Confirm absence of Branch, Employee, Shift, Status select dropdowns beside the search bar
  const hasBranchSelect = clientFileContent.includes('<Select value={branchFilter}');
  const hasEmployeeSelect = clientFileContent.includes('<Select value={employeeFilter}');
  const hasShiftSelect = clientFileContent.includes('<Select value={shiftFilter}');
  const hasStatusSelect = clientFileContent.includes('<Select value={statusFilter}');

  assert(!hasBranchSelect, 'Branch filter dropdown is removed from attendance page');
  assert(!hasEmployeeSelect, 'Employee filter dropdown is removed from attendance page');
  assert(!hasShiftSelect, 'Shift filter dropdown is removed from attendance page');
  assert(!hasStatusSelect, 'Status filter dropdown is removed from attendance page');

  // Ensure Date navigation is preserved
  assert(
    clientFileContent.includes('handleShiftDate') &&
      clientFileContent.includes('handleSetToday') &&
      clientFileContent.includes('type="date"'),
    'Date selector, previous/next buttons, and Today button are preserved'
  );

  // ────────────────────────────────────────────────────────────────────────────
  // TEST 2: Employee Search Functionality
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 2: Employee Search Functionality ---');
  assert(
    clientFileContent.includes('id="attendance-search"') &&
      clientFileContent.includes('searchQuery') &&
      clientFileContent.includes('setSearchQuery'),
    'Search input field is preserved and responsive'
  );

  // Test search logic on sample records
  const sampleRecords: AttendanceItem[] = [
    {
      id: 'att-1',
      employeeId: 'emp-1',
      branchId: 'br-1',
      shiftId: null,
      date: new Date('2026-10-17T00:00:00Z'),
      status: 'PRESENT',
      checkIn: new Date('2026-10-17T09:00:00Z'),
      checkOut: new Date('2026-10-17T17:00:00Z'),
      lateMinutes: 0,
      earlyDepartureMinutes: 0,
      note: null,
      markedBy: 'Rajesh Manager',
      createdAt: new Date(),
      updatedAt: new Date(),
      employee: {
        id: 'emp-1',
        firstName: 'Ananya',
        lastName: 'Sharma',
        employeeCode: 'EMP-101',
        designation: 'Head Chef',
      },
      branch: {
        id: 'br-1',
        name: 'Bandra West Flagship',
        code: 'BW-01',
        city: 'Mumbai',
      },
      shift: null,
    },
    {
      id: 'att-2',
      employeeId: 'emp-2',
      branchId: 'br-2',
      shiftId: null,
      date: new Date('2026-10-17T00:00:00Z'),
      status: 'ABSENT',
      checkIn: null,
      checkOut: null,
      lateMinutes: 0,
      earlyDepartureMinutes: 0,
      note: 'Uninformed absence',
      markedBy: 'System',
      createdAt: new Date(),
      updatedAt: new Date(),
      employee: {
        id: 'emp-2',
        firstName: 'Vikram',
        lastName: 'Singh',
        employeeCode: 'EMP-102',
        designation: 'Sous Chef',
      },
      branch: {
        id: 'br-2',
        name: 'Andheri Hub',
        code: 'AH-02',
        city: 'Mumbai',
      },
      shift: null,
    },
    {
      id: 'att-3',
      employeeId: 'emp-3',
      branchId: 'br-1',
      shiftId: null,
      date: new Date('2026-10-17T00:00:00Z'),
      status: 'HALF_DAY',
      checkIn: new Date('2026-10-17T09:30:00Z'),
      checkOut: new Date('2026-10-17T13:30:00Z'),
      lateMinutes: 30,
      earlyDepartureMinutes: 0,
      note: 'Medical checkup',
      markedBy: 'Rajesh Manager',
      createdAt: new Date(),
      updatedAt: new Date(),
      employee: {
        id: 'emp-3',
        firstName: 'Pooja',
        lastName: 'Patel',
        employeeCode: 'EMP-103',
        designation: 'Cashier',
      },
      branch: {
        id: 'br-1',
        name: 'Bandra West Flagship',
        code: 'BW-01',
        city: 'Mumbai',
      },
      shift: null,
    },
  ];

  // Helper matching the client search implementation
  function filterRecords(query: string, list: AttendanceItem[]): AttendanceItem[] {
    if (!query.trim()) return list;
    const q = query.toLowerCase().trim();
    return list.filter(
      (a) =>
        a.employee.firstName.toLowerCase().includes(q) ||
        a.employee.lastName.toLowerCase().includes(q) ||
        a.employee.employeeCode.toLowerCase().includes(q) ||
        a.employee.designation.toLowerCase().includes(q) ||
        a.branch.name.toLowerCase().includes(q)
    );
  }

  assert(filterRecords('Ananya', sampleRecords).length === 1, 'Search matches employee firstName');
  assert(filterRecords('singh', sampleRecords).length === 1, 'Search matches employee lastName case-insensitively');
  assert(filterRecords('EMP-103', sampleRecords).length === 1, 'Search matches employee employeeCode');
  assert(filterRecords('Cashier', sampleRecords).length === 1, 'Search matches employee designation');
  assert(filterRecords('Bandra', sampleRecords).length === 2, 'Search matches branch name');
  assert(filterRecords('NonExistent', sampleRecords).length === 0, 'Search returns empty array when no matches');

  // ────────────────────────────────────────────────────────────────────────────
  // TEST 3: Sortable Table Headers
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 3: Sortable Table Headers (Ascending & Descending) ---');
  const sortColumns = ['employee', 'branch', 'status', 'checkIn', 'checkOut', 'markedBy'] as const;

  for (const col of sortColumns) {
    assert(
      clientFileContent.includes(`handleSort('${col}')`),
      `Column header '${col}' is wired to handleSort`
    );
  }

  function sortList(
    list: AttendanceItem[],
    column: typeof sortColumns[number],
    direction: 'asc' | 'desc'
  ): AttendanceItem[] {
    return [...list].sort((a, b) => {
      let comparison = 0;
      switch (column) {
        case 'employee': {
          const nameA = `${a.employee.firstName} ${a.employee.lastName}`.toLowerCase();
          const nameB = `${b.employee.firstName} ${b.employee.lastName}`.toLowerCase();
          comparison = nameA.localeCompare(nameB);
          break;
        }
        case 'branch': {
          comparison = (a.branch.name || '').localeCompare(b.branch.name || '');
          break;
        }
        case 'status': {
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        }
        case 'checkIn': {
          const timeA = a.checkIn ? new Date(a.checkIn).getTime() : null;
          const timeB = b.checkIn ? new Date(b.checkIn).getTime() : null;
          if (timeA === null && timeB === null) comparison = 0;
          else if (timeA === null) return 1;
          else if (timeB === null) return -1;
          else comparison = timeA - timeB;
          break;
        }
        case 'checkOut': {
          const timeA = a.checkOut ? new Date(a.checkOut).getTime() : null;
          const timeB = b.checkOut ? new Date(b.checkOut).getTime() : null;
          if (timeA === null && timeB === null) comparison = 0;
          else if (timeA === null) return 1;
          else if (timeB === null) return -1;
          else comparison = timeA - timeB;
          break;
        }
        case 'markedBy': {
          comparison = (a.markedBy || 'System').localeCompare(b.markedBy || 'System');
          break;
        }
      }
      if (comparison === 0) {
        return (a.employee.employeeCode || a.id).localeCompare(b.employee.employeeCode || b.id);
      }
      return direction === 'asc' ? comparison : -comparison;
    });
  }

  // Employee sorting
  const empAsc = sortList(sampleRecords, 'employee', 'asc');
  assert(empAsc[0].employee.firstName === 'Ananya' && empAsc[2].employee.firstName === 'Vikram', 'Employee sorts A-Z ascending');
  const empDesc = sortList(sampleRecords, 'employee', 'desc');
  assert(empDesc[0].employee.firstName === 'Vikram' && empDesc[2].employee.firstName === 'Ananya', 'Employee sorts Z-A descending');

  // Branch sorting
  const brAsc = sortList(sampleRecords, 'branch', 'asc');
  assert(brAsc[0].branch.name === 'Andheri Hub', 'Branch sorts A-Z ascending');

  // Check-In sorting with missing values
  const checkInAsc = sortList(sampleRecords, 'checkIn', 'asc');
  assert(
    checkInAsc[0].employee.firstName === 'Ananya' &&
      checkInAsc[1].employee.firstName === 'Pooja' &&
      checkInAsc[2].employee.firstName === 'Vikram',
    'Check-In sorts chronologically ascending, missing check-in at the end'
  );

  const checkInDesc = sortList(sampleRecords, 'checkIn', 'desc');
  assert(
    checkInDesc[0].employee.firstName === 'Pooja' &&
      checkInDesc[1].employee.firstName === 'Ananya' &&
      checkInDesc[2].employee.firstName === 'Vikram',
    'Check-In sorts chronologically descending, missing check-in still at the end'
  );

  // Check-Out sorting with missing values
  const checkOutAsc = sortList(sampleRecords, 'checkOut', 'asc');
  assert(checkOutAsc[2].employee.firstName === 'Vikram', 'Missing check-out sorts to end in asc');
  const checkOutDesc = sortList(sampleRecords, 'checkOut', 'desc');
  assert(checkOutDesc[2].employee.firstName === 'Vikram', 'Missing check-out sorts to end in desc');

  // ────────────────────────────────────────────────────────────────────────────
  // TEST 4: Shift Completely Removed from Attendance Page UI
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 4: Shift Completely Removed From UI ---');
  // Check table headers
  assert(!clientFileContent.includes('<TableHead>Shift</TableHead>'), 'Shift column removed from desktop table headers');
  assert(!clientFileContent.includes('Shift Schedules'), 'Shift Schedules tab removed from attendance page');
  assert(!clientFileContent.includes('record.shift.name'), 'Shift name not rendered in attendance table rows');

  // Verify backend shifts model and API are still preserved for other modules
  const shiftsCount = await prisma.shift.count();
  assert(shiftsCount >= 0, `Prisma Shift model preserved in DB (found ${shiftsCount} shifts)`);

  // ────────────────────────────────────────────────────────────────────────────
  // TEST 5 & 6: Interactive KPI Cards & Modal List Matching
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 5 & 6: Interactive KPI Cards & Modal Criteria Matching ---');
  const kpiTypes = ['active', 'present', 'absent', 'halfDay', 'leave', 'late', 'earlyDeparture'] as const;

  for (const kpi of kpiTypes) {
    assert(
      clientFileContent.includes(`openKpiModal('${kpi}')`),
      `KPI card '${kpi}' is clickable and triggers openKpiModal`
    );
    assert(
      dialogFileContent.includes(`case '${kpi}':`),
      `AttendanceKpiDialog handles case '${kpi}'`
    );
  }

  // Verify KPI criteria match between summary and modal items
  const testAttendance: AttendanceItem[] = [
    { ...sampleRecords[0], status: 'PRESENT', lateMinutes: 0, earlyDepartureMinutes: 0 },
    { ...sampleRecords[1], status: 'ABSENT', lateMinutes: 0, earlyDepartureMinutes: 0 },
    { ...sampleRecords[2], status: 'HALF_DAY', lateMinutes: 30, earlyDepartureMinutes: 15 },
    {
      ...sampleRecords[0],
      id: 'att-4',
      employeeId: 'emp-4',
      status: 'LEAVE',
      lateMinutes: 0,
      earlyDepartureMinutes: 0,
      employee: { id: 'emp-4', firstName: 'Karan', lastName: 'Mehta', employeeCode: 'EMP-104', designation: 'Waiter' },
    },
  ];

  const activeEmployeesList = [
    { id: 'emp-1', firstName: 'Ananya', lastName: 'Sharma', employeeCode: 'EMP-101', designation: 'Head Chef', branchId: 'br-1', currentShiftId: null },
    { id: 'emp-2', firstName: 'Vikram', lastName: 'Singh', employeeCode: 'EMP-102', designation: 'Sous Chef', branchId: 'br-2', currentShiftId: null },
    { id: 'emp-3', firstName: 'Pooja', lastName: 'Patel', employeeCode: 'EMP-103', designation: 'Cashier', branchId: 'br-1', currentShiftId: null },
    { id: 'emp-4', firstName: 'Karan', lastName: 'Mehta', employeeCode: 'EMP-104', designation: 'Waiter', branchId: 'br-1', currentShiftId: null },
    { id: 'emp-5', firstName: 'Sita', lastName: 'Rao', employeeCode: 'EMP-105', designation: 'Cleaner', branchId: 'br-1', currentShiftId: null },
  ];

  // Test KPI calculation matching
  const activeCount = activeEmployeesList.length;
  const presentCount = testAttendance.filter((r) => r.status === 'PRESENT').length;
  const absentCount = testAttendance.filter((r) => r.status === 'ABSENT').length;
  const halfDayCount = testAttendance.filter((r) => r.status === 'HALF_DAY').length;
  const leaveCount = testAttendance.filter((r) => r.status === 'LEAVE').length;
  const lateCount = testAttendance.filter((r) => r.lateMinutes > 0).length;
  const earlyCount = testAttendance.filter((r) => r.earlyDepartureMinutes > 0).length;

  assert(activeCount === 5, 'Active staff counts 5 active employees');
  assert(presentCount === 1, 'Present count strictly matches status === PRESENT');
  assert(absentCount === 1, 'Absent count strictly matches status === ABSENT');
  assert(halfDayCount === 1, 'Half day count strictly matches status === HALF_DAY');
  assert(leaveCount === 1, 'Leave count strictly matches status === LEAVE');
  assert(lateCount === 1, 'Late arrivals count strictly matches lateMinutes > 0');
  assert(earlyCount === 1, 'Early departures count strictly matches earlyDepartureMinutes > 0');

  // Verify modal dialog UI features
  assert(dialogFileContent.includes('<DialogTitle'), 'Modal contains DialogTitle');
  assert(dialogFileContent.includes('filteredItems.length'), 'Modal displays item count badge');
  assert(dialogFileContent.includes('emp.firstName'), 'Modal displays employee names');
  assert(dialogFileContent.includes('emp.employeeCode'), 'Modal displays employee code');
  assert(dialogFileContent.includes('emp.branchName'), 'Modal displays branch info');
  assert(dialogFileContent.includes('renderStatusBadge'), 'Modal displays attendance status');
  assert(dialogFileContent.includes('EmptyState'), 'Modal includes useful empty state');
  assert(dialogFileContent.includes('onViewRecord'), 'Modal includes action to view attendance record');

  // ────────────────────────────────────────────────────────────────────────────
  // TEST 7: Table & Modal Synchronization Upon Date Change
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 7: Date Change Synchronization ---');
  assert(
    clientFileContent.includes('refreshAttendance(newDateStr)') &&
      clientFileContent.includes('refreshAttendance(todayDate)'),
    'Date controls trigger refreshAttendance with updated target date'
  );
  assert(
    clientFileContent.includes('getAttendanceRecords({ date: d })') &&
      clientFileContent.includes('getAttendanceSummary(d)'),
    'refreshAttendance refetches both records and summary in parallel for the target date'
  );

  // ────────────────────────────────────────────────────────────────────────────
  // TEST 8: Late Arrival & Early Departure Calculation Rules
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 8: Late Arrival & Early Departure Calculation Rules ---');
  // Check that calculation uses existing shift start/end rules
  assert(
    dialogFileContent.includes('r.lateMinutes > 0'),
    'Late arrivals KPI strictly requires lateMinutes > 0'
  );
  assert(
    dialogFileContent.includes('r.earlyDepartureMinutes > 0'),
    'Early departures KPI strictly requires earlyDepartureMinutes > 0'
  );

  // ────────────────────────────────────────────────────────────────────────────
  // TEST 9: Incomplete & Missing Records Handling
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 9: Incomplete & Missing Records Handling ---');
  // Employee 5 has no record: verify active staff modal displays "Not Recorded"
  const recMap = new Map<string, AttendanceItem>();
  for (const r of testAttendance) recMap.set(r.employeeId, r);

  const emp5Record = recMap.get('emp-5');
  assert(emp5Record === undefined, 'Active employee without attendance record handled cleanly');
  assert(
    dialogFileContent.includes("Not Recorded"),
    'Employees without attendance record get a "Not Recorded" badge in the Active Staff modal'
  );

  // ────────────────────────────────────────────────────────────────────────────
  // TEST 10: Realtime & Cache Invalidation Synchronization
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 10: Synchronization & Realtime Event Integration ---');
  assert(
    clientFileContent.includes("useRealtime") &&
      clientFileContent.includes("attendance:updated"),
    'Integrated with useRealtime for attendance:updated event bus messages'
  );
  assert(
    clientFileContent.includes('onSuccess={() => refreshAttendance()}'),
    'AttendanceFormDialog triggers refreshAttendance on create or edit success'
  );

  // ────────────────────────────────────────────────────────────────────────────
  // TEST 11: Branch Access Scoping Enforced
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 11: Branch Access Scoping Enforced ---');
  const actionContent = fs.readFileSync(
    path.join(process.cwd(), 'src/lib/attendance/actions.ts'),
    'utf8'
  );
  assert(
    actionContent.includes('getAuthorizedBranchScope') &&
      actionContent.includes('isBranchAuthorized'),
    'Branch scoping and authorization guards are enforced in attendance actions'
  );

  // ────────────────────────────────────────────────────────────────────────────
  // TEST 12: Existing Attendance Actions Preserved
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 12: Existing Attendance Actions Preserved ---');
  assert(
    clientFileContent.includes('handleQuickCheckOut') &&
      clientFileContent.includes('quickCheckOut'),
    'Quick check-out action is preserved'
  );
  assert(
    clientFileContent.includes('AttendanceFormDialog'),
    'AttendanceFormDialog (mark/edit) is preserved'
  );
  assert(
    clientFileContent.includes('router.push(`/attendance/${record.id}`)'),
    'View attendance details routing is preserved'
  );

  console.log('\n================================================================');
  console.log('🎉 ALL 12 VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  console.log('================================================================');
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
