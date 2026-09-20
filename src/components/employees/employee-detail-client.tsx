'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CreditCard,
  Pencil,
  Power,
  ShieldAlert,
  ShieldCheck,
  User,
  CheckCircle2,
  XCircle,
  Briefcase,
  AlertCircle,
  TrendingUp,
  Gift,
  Lock,
  History,
  Eye,
} from 'lucide-react';

import type { EmployeeItem, BranchOption } from '@/lib/employees/actions';
import { useAuth } from '@/providers/auth-provider';
import { hasPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getEmployeeCompensation } from '@/lib/salary/actions';
import type { EmployeeCompensationSummary } from '@/lib/salary/types';
import {
  formatINR,
  formatDateShort,
  formatDateRange,
  SALARY_RECORD_STATUS_META,
  BONUS_STATUS_META,
  BONUS_TYPE_LABELS,
} from '@/lib/salary/constants';
import { SalaryRevisionDialog } from '@/components/salary/salary-revision-dialog';
import { BonusCreateDialog } from '@/components/salary/bonus-create-dialog';
import { SalaryPeriodDialog } from '@/components/salary/salary-period-dialog';

import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';

import { EmployeeFormDialog } from '@/components/employees/employee-form-dialog';
import { EmployeeStatusDialog } from '@/components/employees/employee-status-dialog';

// ─── Props ──────────────────────────────────────────────────────────────────

interface EmployeeDetailClientProps {
  employee: EmployeeItem;
  branches: BranchOption[];
}

// ─── Component ──────────────────────────────────────────────────────────────

export function EmployeeDetailClient({
  employee,
  branches,
}: EmployeeDetailClientProps) {
  const router = useRouter();
  const authUser = useAuth();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
  const [bonusDialogOpen, setBonusDialogOpen] = useState(false);
  const [periodDialogOpen, setPeriodDialogOpen] = useState(false);

  const [compSummary, setCompSummary] = useState<EmployeeCompensationSummary | null>(null);
  const [activeCompTab, setActiveCompTab] = useState<'timeline' | 'increments' | 'bonuses' | 'periods'>('timeline');

  const canUpdate = hasPermission(authUser, PERMISSIONS.EMPLOYEE_UPDATE);
  const canDeactivate = hasPermission(authUser, PERMISSIONS.EMPLOYEE_DEACTIVATE);
  const canReadSalary = hasPermission(authUser, PERMISSIONS.SALARY_READ);
  const canCreateSalary = hasPermission(authUser, PERMISSIONS.SALARY_CREATE);
  const canCreateIncrement = hasPermission(authUser, PERMISSIONS.INCREMENT_CREATE);
  const canCreateBonus = hasPermission(authUser, PERMISSIONS.BONUS_CREATE);

  useEffect(() => {
    if (canReadSalary && employee.id) {
      getEmployeeCompensation(employee.id).then((res) => {
        if (res.success && res.data) {
          setCompSummary(res.data);
        }
      });
    }
  }, [canReadSalary, employee.id]);

  const handleFormSuccess = () => {
    setEditDialogOpen(false);
    router.refresh();
  };

  const handleStatusSuccess = () => {
    setStatusDialogOpen(false);
    router.refresh();
  };

  // ─── Formatters ─────────────────────────────────────────────────────────

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'Not specified';
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(date));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const calculateTenure = (joiningDate: Date | string) => {
    const start = new Date(joiningDate);
    const now = new Date();
    const diffMonths =
      (now.getFullYear() - start.getFullYear()) * 12 +
      (now.getMonth() - start.getMonth());

    if (diffMonths < 1) {
      return 'Joined this month';
    } else if (diffMonths < 12) {
      return `${diffMonths} month${diffMonths > 1 ? 's' : ''}`;
    } else {
      const years = Math.floor(diffMonths / 12);
      const months = diffMonths % 12;
      return `${years} year${years > 1 ? 's' : ''}${months > 0 ? `, ${months} month${months > 1 ? 's' : ''}` : ''}`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/employees')}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1.5 size-4" />
          Back to Employees
        </Button>
      </div>

      {/* Header Banner */}
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl font-bold text-primary">
            {employee.firstName[0]}
            {employee.lastName[0]}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {employee.firstName} {employee.lastName}
              </h1>
              <Badge variant="outline" className="font-mono text-xs">
                {employee.employeeCode}
              </Badge>
              <Badge
                variant={employee.employmentStatus === 'ACTIVE' ? 'default' : 'secondary'}
                className={
                  employee.employmentStatus === 'ACTIVE'
                    ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                    : 'bg-muted text-muted-foreground'
                }
              >
                {employee.employmentStatus === 'ACTIVE' ? (
                  <CheckCircle2 className="mr-1 size-3" />
                ) : (
                  <XCircle className="mr-1 size-3" />
                )}
                {employee.employmentStatus}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground flex items-center gap-2">
              <span className="font-medium text-foreground">{employee.designation}</span>
              <span>•</span>
              <span>{employee.branch.name} ({employee.branch.city})</span>
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          {canUpdate && (
            <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
              <Pencil className="mr-1.5 size-4" />
              Edit Employee
            </Button>
          )}
          {canDeactivate && (
            <Button
              variant={employee.employmentStatus === 'ACTIVE' ? 'destructive' : 'default'}
              size="sm"
              onClick={() => setStatusDialogOpen(true)}
            >
              <Power className="mr-1.5 size-4" />
              {employee.employmentStatus === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
            </Button>
          )}
        </div>
      </div>

      {/* Main Details Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Card 1: Personal Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="size-4 text-primary" />
              <CardTitle className="text-base">Personal Information</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-muted-foreground">Full Name</span>
                <p className="text-sm font-medium">
                  {employee.firstName} {employee.lastName}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Date of Birth</span>
                <p className="text-sm font-medium">
                  {formatDate(employee.dateOfBirth)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t pt-3">
              <div>
                <span className="text-xs text-muted-foreground">Phone</span>
                <p className="text-sm font-medium">
                  <a
                    href={`tel:${employee.phone}`}
                    className="text-primary hover:underline"
                  >
                    {employee.phone}
                  </a>
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Email Address</span>
                <p className="text-sm font-medium">
                  {employee.email ? (
                    <a
                      href={`mailto:${employee.email}`}
                      className="text-primary hover:underline truncate block"
                    >
                      {employee.email}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">Not provided</span>
                  )}
                </p>
              </div>
            </div>

            <div className="border-t pt-3">
              <span className="text-xs text-muted-foreground">Residential Address</span>
              <p className="text-sm font-medium">
                {employee.address || <span className="text-muted-foreground">No address recorded</span>}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Employment Details */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Briefcase className="size-4 text-primary" />
              <CardTitle className="text-base">Employment Details</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-muted-foreground">Assigned Branch</span>
                <p className="text-sm font-medium">
                  <Link
                    href={`/branches/${employee.branch.id}`}
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    {employee.branch.name}
                  </Link>
                </p>
                <p className="text-xs text-muted-foreground">{employee.branch.city}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Designation</span>
                <p className="text-sm font-medium">{employee.designation}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t pt-3">
              <div>
                <span className="text-xs text-muted-foreground">Joining Date</span>
                <p className="text-sm font-medium">
                  {formatDate(employee.joiningDate)}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Service Tenure</span>
                <p className="text-sm font-medium">
                  {calculateTenure(employee.joiningDate)}
                </p>
              </div>
            </div>

            <div className="border-t pt-3">
              <span className="text-xs text-muted-foreground">Branch Status</span>
              <div className="mt-1 flex items-center gap-2">
                <Badge
                  variant={employee.branch.status === 'ACTIVE' ? 'outline' : 'secondary'}
                  className="text-xs"
                >
                  Branch is {employee.branch.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Compensation & Base Structure */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="size-4 text-primary" />
                <CardTitle className="text-base">Compensation</CardTitle>
              </div>
              {canReadSalary && (
                <div className="flex items-center gap-1">
                  {canCreateIncrement && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRevisionDialogOpen(true)}
                      className="h-7 gap-1 text-xs text-primary hover:text-primary hover:bg-primary/10"
                    >
                      <TrendingUp className="size-3" />
                      Revise
                    </Button>
                  )}
                  {canCreateBonus && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setBonusDialogOpen(true)}
                      className="h-7 gap-1 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                    >
                      <Gift className="size-3" />
                      Bonus
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {canReadSalary ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground">Current Base Salary</span>
                    <p className="text-xl font-bold tracking-tight text-foreground">
                      {formatCurrency(
                        compSummary?.currentStructure?.salary ?? employee.salary
                      )}
                    </p>
                    {compSummary?.currentStructure?.effectiveFrom && (
                      <span className="text-[10px] text-muted-foreground">
                        Active since {formatDateShort(compSummary.currentStructure.effectiveFrom)}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Salary Type</span>
                    <p className="text-sm font-medium capitalize mt-1">
                      <Badge variant="outline">
                        {compSummary?.currentStructure?.salaryType ?? employee.salaryType}
                      </Badge>
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-foreground">Salary Records: </span>
                    {compSummary?.salaryRecords.length || 0} periods generated
                  </div>
                  {canCreateSalary && (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setPeriodDialogOpen(true)}
                      className="h-auto p-0 text-xs font-semibold"
                    >
                      + Generate Period
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-border/80 bg-muted/30 p-4 text-center">
                <Lock className="mx-auto size-5 text-muted-foreground/60 mb-1" />
                <p className="text-xs font-medium text-foreground">Compensation Restricted</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  You do not have permission to view this employee&apos;s salary and compensation details.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 4: Emergency Contact */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 text-primary" />
              <CardTitle className="text-base">Emergency Contact</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-muted-foreground">Contact Person</span>
                <p className="text-sm font-medium">
                  {employee.emergencyContactName || (
                    <span className="text-muted-foreground">Not provided</span>
                  )}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Emergency Phone</span>
                <p className="text-sm font-medium">
                  {employee.emergencyContactPhone ? (
                    <a
                      href={`tel:${employee.emergencyContactPhone}`}
                      className="text-primary hover:underline"
                    >
                      {employee.emergencyContactPhone}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">Not provided</span>
                  )}
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground border-t pt-3">
              To be contacted in case of workplace emergencies or health incidents.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Card 5: Application User Account Linking */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            <div>
              <CardTitle className="text-base">System Application Account</CardTitle>
              <CardDescription className="text-xs">
                Software login credentials and role-based permissions for this staff member.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {employee.user ? (
            <div className="flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">
                    {employee.user.name}
                  </span>
                  <Badge variant="default" className="text-xs">
                    {employee.user.role.name}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Login Email: <span className="font-mono text-foreground">{employee.user.email}</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-background text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
                  <CheckCircle2 className="mr-1 size-3" />
                  Account Linked
                </Badge>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-border/80 bg-muted/20 p-4">
              <ShieldAlert className="size-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Not linked to an application account
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  This employee works directly on-site (kitchen, service, or delivery) and does not have software login credentials. You can link an account at any time by editing the employee.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card 6: Comprehensive Compensation History & Timeline */}
      {canReadSalary && compSummary && (
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/20">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <History className="size-5 text-primary" />
                <div>
                  <CardTitle className="text-base font-bold">
                    Compensation History & Ledger
                  </CardTitle>
                  <CardDescription>
                    Complete timeline of historical salary revisions, increment records, bonuses, and period calculations.
                  </CardDescription>
                </div>
              </div>

              {/* Sub Tabs */}
              <div className="flex rounded-lg bg-muted p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveCompTab('timeline')}
                  className={`rounded-md px-3 py-1 font-medium transition-colors ${
                    activeCompTab === 'timeline'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Salary History ({compSummary.structures.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCompTab('increments')}
                  className={`rounded-md px-3 py-1 font-medium transition-colors ${
                    activeCompTab === 'increments'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Increments ({compSummary.increments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCompTab('bonuses')}
                  className={`rounded-md px-3 py-1 font-medium transition-colors ${
                    activeCompTab === 'bonuses'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Bonuses ({compSummary.bonuses.length + compSummary.incentives.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCompTab('periods')}
                  className={`rounded-md px-3 py-1 font-medium transition-colors ${
                    activeCompTab === 'periods'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Periods ({compSummary.salaryRecords.length})
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4">
            {/* Tab 1: Salary History Timeline */}
            {activeCompTab === 'timeline' && (
              <div className="space-y-4">
                {compSummary.structures.length > 0 ? (
                  <div className="relative border-l-2 border-primary/30 pl-4 space-y-6 my-2 ml-2">
                    {compSummary.structures.map((s) => (
                      <div key={s.id} className="relative">
                        <div
                          className={`absolute -left-5.75 top-1.5 size-3 rounded-full border-2 border-background ${
                            s.status === 'ACTIVE'
                              ? 'bg-primary ring-2 ring-primary/20'
                              : 'bg-muted-foreground/50'
                          }`}
                        />
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-base font-bold text-foreground">
                              {formatINR(s.salary)}
                            </span>
                            <Badge
                              variant="outline"
                              className={
                                s.status === 'ACTIVE'
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-xs'
                                  : 'text-xs text-muted-foreground'
                              }
                            >
                              {s.status}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              {s.salaryType}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDateShort(s.effectiveFrom)} –{' '}
                            {s.effectiveTo ? formatDateShort(s.effectiveTo) : 'Present'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {s.reason || 'Structure rate modification'} • Recorded by {s.createdBy}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    No historical salary structures found.
                  </p>
                )}
              </div>
            )}

            {/* Tab 2: Increments */}
            {activeCompTab === 'increments' && (
              <div>
                {compSummary.increments.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b bg-muted/40 font-semibold text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2">Effective Date</th>
                          <th className="px-3 py-2 text-right">Previous</th>
                          <th className="px-3 py-2 text-right">New Salary</th>
                          <th className="px-3 py-2 text-right">Increase</th>
                          <th className="px-3 py-2 text-center">Percentage</th>
                          <th className="px-3 py-2">Reason</th>
                          <th className="px-3 py-2">Applied By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {compSummary.increments.map((inc) => (
                          <tr key={inc.id} className="hover:bg-muted/20">
                            <td className="px-3 py-2 font-medium">
                              {formatDateShort(inc.effectiveDate)}
                            </td>
                            <td className="px-3 py-2 text-right text-muted-foreground">
                              {formatINR(inc.previousSalary)}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-foreground">
                              {formatINR(inc.newSalary)}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                              +{formatINR(inc.difference)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <Badge
                                variant="outline"
                                className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px]"
                              >
                                +{inc.percentage}%
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">
                              {inc.reason || 'Appraisal'}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {inc.createdBy}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    No salary increments recorded for this employee yet.
                  </p>
                )}
              </div>
            )}

            {/* Tab 3: Bonuses & Incentives */}
            {activeCompTab === 'bonuses' && (
              <div>
                {compSummary.bonuses.length > 0 || compSummary.incentives.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b bg-muted/40 font-semibold text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Award Category</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                          <th className="px-3 py-2">Reason</th>
                          <th className="px-3 py-2 text-center">Status</th>
                          <th className="px-3 py-2">Recorded By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {compSummary.bonuses.map((b) => {
                          const meta = BONUS_STATUS_META[b.status] || BONUS_STATUS_META.DRAFT;
                          return (
                            <tr key={b.id} className="hover:bg-muted/20">
                              <td className="px-3 py-2 font-medium">
                                {formatDateShort(b.bonusDate)}
                              </td>
                              <td className="px-3 py-2">
                                {BONUS_TYPE_LABELS[b.type] || b.type}
                              </td>
                              <td className="px-3 py-2 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                +{formatINR(b.amount)}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">
                                {b.reason}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <Badge variant="outline" className={`text-[10px] ${meta.badgeClass}`}>
                                  {meta.label}
                                </Badge>
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {b.createdBy}
                              </td>
                            </tr>
                          );
                        })}

                        {compSummary.incentives.map((i) => {
                          const meta = BONUS_STATUS_META[i.status] || BONUS_STATUS_META.APPROVED;
                          return (
                            <tr key={i.id} className="hover:bg-muted/20">
                              <td className="px-3 py-2 font-medium">
                                {formatDateShort(i.incentiveDate)}
                              </td>
                              <td className="px-3 py-2">
                                Target / Sales Incentive
                              </td>
                              <td className="px-3 py-2 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                +{formatINR(i.amount)}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">
                                {i.reason}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <Badge variant="outline" className={`text-[10px] ${meta.badgeClass}`}>
                                  {meta.label}
                                </Badge>
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {i.createdBy}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    No bonus awards recorded for this employee yet.
                  </p>
                )}
              </div>
            )}

            {/* Tab 4: Salary Periods */}
            {activeCompTab === 'periods' && (
              <div>
                {compSummary.salaryRecords.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b bg-muted/40 font-semibold text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2">Salary #</th>
                          <th className="px-3 py-2">Period</th>
                          <th className="px-3 py-2 text-right">Base Salary</th>
                          <th className="px-3 py-2 text-right">Bonus / Inc</th>
                          <th className="px-3 py-2 text-right">Adjustment</th>
                          <th className="px-3 py-2 text-right">Gross Total</th>
                          <th className="px-3 py-2 text-center">Status</th>
                          <th className="px-3 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {compSummary.salaryRecords.map((r) => {
                          const meta =
                            SALARY_RECORD_STATUS_META[r.status] ||
                            SALARY_RECORD_STATUS_META.DRAFT;

                          return (
                            <tr key={r.id} className="hover:bg-muted/20">
                              <td className="px-3 py-2 font-mono font-medium">
                                <Link
                                  href={`/salary/${r.id}`}
                                  className="text-primary hover:underline"
                                >
                                  {r.salaryNumber}
                                </Link>
                              </td>
                              <td className="px-3 py-2">
                                {formatDateRange(r.periodStart, r.periodEnd)}
                              </td>
                              <td className="px-3 py-2 text-right text-muted-foreground">
                                {formatINR(r.baseSalary)}
                              </td>
                              <td className="px-3 py-2 text-right text-emerald-600 dark:text-emerald-400">
                                +{formatINR(r.bonusAmount + r.incentiveAmount)}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {r.adjustmentAmount !== 0 ? formatINR(r.adjustmentAmount) : '₹0'}
                              </td>
                              <td className="px-3 py-2 text-right font-bold text-foreground">
                                {formatINR(r.grossAmount)}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <Badge variant="outline" className={`text-[10px] ${meta.badgeClass}`}>
                                  {meta.label}
                                </Badge>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <Link
                                  href={`/salary/${r.id}`}
                                  className={buttonVariants({
                                    variant: 'ghost',
                                    size: 'xs',
                                    className: 'gap-1 text-[11px]',
                                  })}
                                >
                                  <Eye className="size-3" />
                                  Review
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    No salary period records generated for this employee yet.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Salary Revision Dialog */}
      <SalaryRevisionDialog
        open={revisionDialogOpen}
        onOpenChange={setRevisionDialogOpen}
        defaultEmployeeId={employee.id}
        branchId={employee.branch.id}
        onSuccess={() => {
          if (canReadSalary) {
            getEmployeeCompensation(employee.id).then((res) => {
              if (res.success && res.data) setCompSummary(res.data);
            });
          }
        }}
      />

      {/* Bonus Award Dialog */}
      <BonusCreateDialog
        open={bonusDialogOpen}
        onOpenChange={setBonusDialogOpen}
        defaultEmployeeId={employee.id}
        branchId={employee.branch.id}
        onSuccess={() => {
          if (canReadSalary) {
            getEmployeeCompensation(employee.id).then((res) => {
              if (res.success && res.data) setCompSummary(res.data);
            });
          }
        }}
      />

      {/* Period Dialog */}
      <SalaryPeriodDialog
        open={periodDialogOpen}
        onOpenChange={setPeriodDialogOpen}
        branchId={employee.branch.id}
        onSuccess={() => {
          if (canReadSalary) {
            getEmployeeCompensation(employee.id).then((res) => {
              if (res.success && res.data) setCompSummary(res.data);
            });
          }
        }}
      />

      {/* Edit Dialog */}
      <EmployeeFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        branches={branches}
        employee={employee}
        onSuccess={handleFormSuccess}
      />

      {/* Status Confirmation Dialog */}
      <EmployeeStatusDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        employee={employee}
        onSuccess={handleStatusSuccess}
      />
    </div>
  );
}
