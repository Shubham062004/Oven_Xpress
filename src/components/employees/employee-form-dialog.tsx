'use client';

import { useState, useTransition } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import {
  createEmployee,
  updateEmployee,
  type EmployeeItem,
  type BranchOption,
} from '@/lib/employees/actions';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
} from '@/lib/validations/employee';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ─── Props ──────────────────────────────────────────────────────────────────

interface EmployeeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches?: BranchOption[];
  employee?: EmployeeItem; // If provided, the form is in "edit" mode
  onSuccess: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function EmployeeFormDialog({
  open,
  onOpenChange,
  employee,
  onSuccess,
}: EmployeeFormDialogProps) {
  const isEditing = !!employee;
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // ─── Form State ────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    firstName: employee?.firstName ?? '',
    lastName: employee?.lastName ?? '',
    phone: employee?.phone ?? '',
    email: employee?.email ?? '',
    dateOfBirth: employee?.dateOfBirth
      ? new Date(employee.dateOfBirth).toISOString().split('T')[0]
      : '',
    address: employee?.address ?? '',
    employeeCode: employee?.employeeCode ?? '',
    joiningDate: employee?.joiningDate
      ? new Date(employee.joiningDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    employmentStatus: (employee?.employmentStatus ?? 'ACTIVE') as 'ACTIVE' | 'INACTIVE',
    salary: employee?.salary !== undefined ? String(employee.salary) : '',
    salaryType: (employee?.salaryType ?? 'MONTHLY') as 'MONTHLY' | 'DAILY' | 'HOURLY',
    emergencyContactName: employee?.emergencyContactName ?? '',
    emergencyContactPhone: employee?.emergencyContactPhone ?? '',
  });

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (formError) setFormError(null);
  };

  // ─── Client-side Validation ───────────────────────────────────────────────

  const validateClient = (): boolean => {
    const payload = {
      ...formData,
      salary: formData.salary ? Number(formData.salary) : 0,
      designation: employee?.designation || 'Unassigned',
      branchId: employee?.branchId || null,
    };

    const schema = isEditing ? updateEmployeeSchema : createEmployeeSchema;
    const result = schema.safeParse(payload);

    if (!result.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0]?.toString() ?? '_form';
        if (!errors[key]) errors[key] = [];
        errors[key].push(issue.message);
      }
      setFieldErrors(errors);
      return false;
    }

    setFieldErrors({});
    return true;
  };

  // ─── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateClient()) {
      toast.error('Please resolve the validation errors.');
      return;
    }

    setFormError(null);

    const payload = {
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim() || undefined,
      dateOfBirth: formData.dateOfBirth || undefined,
      address: formData.address.trim() || undefined,
      employeeCode: formData.employeeCode.trim().toUpperCase(),
      joiningDate: formData.joiningDate,
      employmentStatus: formData.employmentStatus,
      salary: Number(formData.salary) || 0,
      salaryType: formData.salaryType,
      emergencyContactName: formData.emergencyContactName.trim() || undefined,
      emergencyContactPhone: formData.emergencyContactPhone.trim() || undefined,
      designation: employee?.designation || 'Unassigned',
      branchId: employee?.branchId || null,
    };

    startTransition(async () => {
      let result;

      if (isEditing && employee) {
        result = await updateEmployee(employee.id, payload);
      } else {
        result = await createEmployee(payload);
      }

      if (result.success) {
        toast.success(
          isEditing
            ? `Employee ${result.data?.firstName} ${result.data?.lastName} updated.`
            : `Employee ${result.data?.firstName} ${result.data?.lastName} added successfully.`
        );

        onOpenChange(false);
        onSuccess();
      } else {
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
        setFormError(result.error ?? 'Failed to save employee.');
        toast.error(result.error ?? 'Failed to save employee.');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `Edit Employee (${employee?.employeeCode})` : 'Add New Employee'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update personal details, compensation, and emergency contacts.'
              : 'Add a new employee with personal, joining, compensation, and emergency contact details.'}
          </DialogDescription>
        </DialogHeader>

        {formError && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Section 1: Personal Information */}
          <div className="space-y-3">
            <h3 className="border-b pb-1 text-sm font-semibold text-foreground">
              1. Personal Information
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="emp-firstName">
                  First Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="emp-firstName"
                  value={formData.firstName}
                  onChange={(e) => updateField('firstName', e.target.value)}
                  placeholder="e.g. John"
                  disabled={isPending}
                  aria-invalid={!!fieldErrors.firstName}
                />
                {fieldErrors.firstName && (
                  <p className="text-xs text-destructive">{fieldErrors.firstName[0]}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emp-lastName">
                  Last Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="emp-lastName"
                  value={formData.lastName}
                  onChange={(e) => updateField('lastName', e.target.value)}
                  placeholder="e.g. Doe"
                  disabled={isPending}
                  aria-invalid={!!fieldErrors.lastName}
                />
                {fieldErrors.lastName && (
                  <p className="text-xs text-destructive">{fieldErrors.lastName[0]}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="emp-phone">
                  Phone Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="emp-phone"
                  value={formData.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="+91 98765 43210"
                  disabled={isPending}
                  aria-invalid={!!fieldErrors.phone}
                />
                {fieldErrors.phone && (
                  <p className="text-xs text-destructive">{fieldErrors.phone[0]}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emp-email">Email Address</Label>
                <Input
                  id="emp-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="john.doe@example.com"
                  disabled={isPending}
                  aria-invalid={!!fieldErrors.email}
                />
                {fieldErrors.email && (
                  <p className="text-xs text-destructive">{fieldErrors.email[0]}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="emp-dob">Date of Birth</Label>
                <Input
                  id="emp-dob"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => updateField('dateOfBirth', e.target.value)}
                  disabled={isPending}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emp-address">Residential Address</Label>
                <Input
                  id="emp-address"
                  value={formData.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  placeholder="Street address, city"
                  disabled={isPending}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Employment Details (ID & Date of Joining) */}
          <div className="space-y-3">
            <h3 className="border-b pb-1 text-sm font-semibold text-foreground">
              2. Employment Information
            </h3>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="emp-code">
                  Employee ID / Code <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="emp-code"
                  value={formData.employeeCode}
                  onChange={(e) => updateField('employeeCode', e.target.value.toUpperCase())}
                  placeholder="e.g. EMP-0010"
                  disabled={isEditing || isPending}
                  aria-invalid={!!fieldErrors.employeeCode}
                  className="font-mono uppercase"
                />
                {isEditing ? (
                  <p className="text-xs text-muted-foreground">
                    Employee ID is an immutable identifier.
                  </p>
                ) : (
                  fieldErrors.employeeCode && (
                    <p className="text-xs text-destructive">{fieldErrors.employeeCode[0]}</p>
                  )
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emp-joiningDate">
                  Date of Joining <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="emp-joiningDate"
                  type="date"
                  value={formData.joiningDate}
                  onChange={(e) => updateField('joiningDate', e.target.value)}
                  disabled={isPending}
                  aria-invalid={!!fieldErrors.joiningDate}
                />
                {fieldErrors.joiningDate && (
                  <p className="text-xs text-destructive">{fieldErrors.joiningDate[0]}</p>
                )}
              </div>
            </div>

            {isEditing && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="emp-status">Employment Status</Label>
                  <Select
                    value={formData.employmentStatus}
                    onValueChange={(val) => updateField('employmentStatus', val ?? 'ACTIVE')}
                  >
                    <SelectTrigger id="emp-status" className="w-full" disabled={isPending}>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Compensation */}
          <div className="space-y-3">
            <h3 className="border-b pb-1 text-sm font-semibold text-foreground">
              3. Compensation
            </h3>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="emp-salary">
                  Basic Salary Amount <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                    ₹
                  </span>
                  <Input
                    id="emp-salary"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.salary}
                    onChange={(e) => updateField('salary', e.target.value)}
                    placeholder="0.00"
                    className="pl-7 font-mono"
                    disabled={isPending}
                    aria-invalid={!!fieldErrors.salary}
                  />
                </div>
                {fieldErrors.salary && (
                  <p className="text-xs text-destructive">{fieldErrors.salary[0]}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emp-salaryType">Salary Type</Label>
                <Select
                  value={formData.salaryType}
                  onValueChange={(val) => updateField('salaryType', val ?? 'MONTHLY')}
                >
                  <SelectTrigger id="emp-salaryType" className="w-full" disabled={isPending}>
                    <SelectValue placeholder="Salary Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="DAILY">Daily</SelectItem>
                    <SelectItem value="HOURLY">Hourly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Section 4: Emergency Contact */}
          <div className="space-y-3">
            <h3 className="border-b pb-1 text-sm font-semibold text-foreground">
              4. Emergency Contact
            </h3>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="emp-emergName">Emergency Contact Name</Label>
                <Input
                  id="emp-emergName"
                  value={formData.emergencyContactName}
                  onChange={(e) => updateField('emergencyContactName', e.target.value)}
                  placeholder="Contact person name"
                  disabled={isPending}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emp-emergPhone">Emergency Contact Phone</Label>
                <Input
                  id="emp-emergPhone"
                  value={formData.emergencyContactPhone}
                  onChange={(e) => updateField('emergencyContactPhone', e.target.value)}
                  placeholder="+91 98765 12345"
                  disabled={isPending}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Employee'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
