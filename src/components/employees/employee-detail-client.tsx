'use client';

import { useState } from 'react';
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
} from 'lucide-react';

import type { EmployeeItem, BranchOption } from '@/lib/employees/actions';
import { useAuth } from '@/providers/auth-provider';
import { hasPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';

import { Button } from '@/components/ui/button';
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

  const canUpdate = hasPermission(authUser, PERMISSIONS.EMPLOYEE_UPDATE);
  const canDeactivate = hasPermission(authUser, PERMISSIONS.EMPLOYEE_DEACTIVATE);

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

        {/* Card 3: Compensation */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="size-4 text-primary" />
              <CardTitle className="text-base">Compensation</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-muted-foreground">Base Salary</span>
                <p className="text-xl font-bold tracking-tight">
                  {formatCurrency(employee.salary)}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Payment Frequency</span>
                <p className="text-sm font-medium capitalize mt-1">
                  <Badge variant="outline">{employee.salaryType}</Badge>
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Note: </span>
              This record tracks base agreed compensation. Detailed payroll calculations,
              attendance deductions, overtime, and bonuses will be managed through the upcoming Payroll module.
            </div>
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
