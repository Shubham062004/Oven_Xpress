import {
  SalaryType,
  SalaryStructureStatus,
  BonusType,
  BonusStatus,
  IncrementStatus,
  SalaryRecordStatus,
} from '@prisma/client';

export interface AttendancePeriodSummary {
  totalWorkingDays: number;
  present: number;
  absent: number;
  halfDay: number;
  leave: number;
  lateArrivals: number;
  earlyDepartures: number;
}

export interface SalaryDashboardStats {
  activeEmployeesWithSalary: number;
  pendingSalaryReviews: number;
  approvedSalaryRecords: number;
  totalApprovedBonuses: number;
  recentIncrementsCount: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface SalaryListItem {
  id: string;
  salaryNumber: string;
  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    designation: string;
    branchId: string;
    branchName: string;
  };
  branch: {
    id: string;
    name: string;
    city: string;
  };
  periodStart: string;
  periodEnd: string;
  baseSalary: number;
  bonusAmount: number;
  incentiveAmount: number;
  adjustmentAmount: number;
  grossAmount: number;
  status: SalaryRecordStatus;
  createdAt: string;
}

export interface SalaryDetail {
  id: string;
  salaryNumber: string;
  employeeId: string;
  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    designation: string;
    branchId: string;
    branchName: string;
    phone: string;
  };
  branchId: string;
  branch: {
    id: string;
    name: string;
    city: string;
  };
  periodStart: string;
  periodEnd: string;
  baseSalary: number;
  bonusAmount: number;
  incentiveAmount: number;
  adjustmentAmount: number;
  grossAmount: number;
  status: SalaryRecordStatus;
  notes: string | null;
  attendanceSummary: AttendancePeriodSummary | null;
  bonuses: BonusItem[];
  incentives: IncentiveItem[];
  auditLogs: SalaryAuditLogItem[];
  createdBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  cancelledBy: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SalaryStructureItem {
  id: string;
  employeeId: string;
  salary: number;
  salaryType: SalaryType;
  effectiveFrom: string;
  effectiveTo: string | null;
  reason: string | null;
  status: SalaryStructureStatus;
  createdBy: string;
  createdAt: string;
}

export interface IncrementItem {
  id: string;
  employeeId: string;
  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    designation: string;
    branchName: string;
  };
  branch: {
    id: string;
    name: string;
    city: string;
  };
  previousSalary: number;
  newSalary: number;
  difference: number;
  percentage: number;
  effectiveDate: string;
  reason: string | null;
  notes: string | null;
  status: IncrementStatus;
  createdBy: string;
  createdAt: string;
}

export interface BonusItem {
  id: string;
  employeeId: string;
  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    designation: string;
    branchName: string;
  };
  branch: {
    id: string;
    name: string;
    city: string;
  };
  amount: number;
  type: BonusType;
  reason: string;
  bonusDate: string;
  status: BonusStatus;
  rejectionReason: string | null;
  createdBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface IncentiveItem {
  id: string;
  employeeId: string;
  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    designation: string;
    branchName: string;
  };
  branch: {
    id: string;
    name: string;
    city: string;
  };
  amount: number;
  reason: string;
  incentiveDate: string;
  status: BonusStatus;
  rejectionReason: string | null;
  createdBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface SalaryAuditLogItem {
  id: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  grossAmount: number | null;
  performedBy: string;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface EmployeeCompensationSummary {
  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    designation: string;
    branchId: string;
    branchName: string;
    employmentStatus: string;
  };
  currentStructure: SalaryStructureItem | null;
  structures: SalaryStructureItem[];
  increments: IncrementItem[];
  bonuses: BonusItem[];
  incentives: IncentiveItem[];
  salaryRecords: SalaryListItem[];
}
