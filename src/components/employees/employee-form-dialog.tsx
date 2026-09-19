'use client';

import { useState, useEffect, useTransition } from 'react';
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import {
  createEmployee,
  updateEmployee,
  getAvailableUsersForLinking,
  type EmployeeItem,
  type BranchOption,
  type UserOption,
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
  branches: BranchOption[];
  employee?: EmployeeItem; // If provided, the form is in "edit" mode
  onSuccess: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function EmployeeFormDialog({
  open,
  onOpenChange,
  branches,
  employee,
  onSuccess,
}: EmployeeFormDialogProps) {
  const isEditing = !!employee;
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Linkable user accounts
  const [users, setUsers] = useState<UserOption[]>([]);

  // ─── Form State ─────────────────────────────────────────────────────────

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
    designation: employee?.designation ?? '',
    branchId: employee?.branchId ?? branches[0]?.id ?? '',
    joiningDate: employee?.joiningDate
      ? new Date(employee.joiningDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    employmentStatus: (employee?.employmentStatus ?? 'ACTIVE') as 'ACTIVE' | 'INACTIVE',
    salary: employee?.salary !== undefined ? String(employee.salary) : '',
    salaryType: (employee?.salaryType ?? 'MONTHLY') as 'MONTHLY' | 'DAILY' | 'HOURLY',
    emergencyContactName: employee?.emergencyContactName ?? '',
    emergencyContactPhone: employee?.emergencyContactPhone ?? '',
    userId: employee?.userId ?? '',
  });

  // Fetch available users asynchronously when dialog opens
  useEffect(() => {
    let active = true;
    if (open) {
      getAvailableUsersForLinking(employee?.id).then((res) => {
        if (active && res.success && res.data) {
          setUsers(res.data);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [open, employee?.id]);

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

  // ─── Client-side Validation ─────────────────────────────────────────────

  const validateClient = (): boolean => {
    const payload = {
      ...formData,
      salary: formData.salary ? Number(formData.salary) : 0,
      userId: formData.userId === 'NONE' || formData.userId === '' ? null : formData.userId,
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

  // ─── Submit ─────────────────────────────────────────────────────────────

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateClient()) {
      toast.error('Please resolve the validation errors.');
      return;
    }

    setFormError(null);

    const payload = {
      ...formData,
      salary: Number(formData.salary) || 0,
      userId: formData.userId === 'NONE' || formData.userId === '' ? null : formData.userId,
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `Edit Employee (${employee?.employeeCode})` : 'Add New Employee'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update personal, employment, and compensation details. Employee code is immutable.'
              : 'Add a new staff member to the restaurant directory. Active employees must belong to a branch.'}
          </DialogDescription>
        </DialogHeader>

        {formError && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Personal Information */}
          <div className="space-y-4">
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

          {/* Section 2: Employment Details */}
          <div className="space-y-4">
            <h3 className="border-b pb-1 text-sm font-semibold text-foreground">
              2. Employment Information
            </h3>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="emp-code">
                  Employee Code <span className="text-destructive">*</span>
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
                    Employee code is an immutable identifier and cannot be changed.
                  </p>
                ) : (
                  fieldErrors.employeeCode && (
                    <p className="text-xs text-destructive">{fieldErrors.employeeCode[0]}</p>
                  )
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emp-designation">
                  Job Designation <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="emp-designation"
                  value={formData.designation}
                  onChange={(e) => updateField('designation', e.target.value)}
                  placeholder="e.g. Head Chef, Waiter, Cashier"
                  disabled={isPending}
                  aria-invalid={!!fieldErrors.designation}
                />
                {fieldErrors.designation && (
                  <p className="text-xs text-destructive">{fieldErrors.designation[0]}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="emp-branch">
                  Assigned Branch <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.branchId}
                  onValueChange={(val) => updateField('branchId', val ?? '')}
                >
                  <SelectTrigger id="emp-branch" className="w-full" disabled={isPending}>
                    <SelectValue placeholder="Select a branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name} ({b.city})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.branchId && (
                  <p className="text-xs text-destructive">{fieldErrors.branchId[0]}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emp-joiningDate">
                  Joining Date <span className="text-destructive">*</span>
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
          </div>

          {/* Section 3: Compensation */}
          <div className="space-y-4">
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
                    className="pl-7"
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

          {/* Section 4: Emergency Contact & System Account */}
          <div className="space-y-4">
            <h3 className="border-b pb-1 text-sm font-semibold text-foreground">
              4. Emergency Contact & Account Linking
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

            <div className="space-y-1.5 rounded-lg border border-border/60 bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                <Label htmlFor="emp-userId" className="font-medium">
                  Link System Account (Optional)
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                If this employee requires login access to the software, link an existing application user account below.
              </p>
              <Select
                value={formData.userId || 'NONE'}
                onValueChange={(val) => updateField('userId', val === 'NONE' ? '' : (val ?? ''))}
              >
                <SelectTrigger id="emp-userId" className="w-full" disabled={isPending}>
                  <SelectValue placeholder="No application account linked" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">-- No linked account --</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.email}) — [{u.roleName}]
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.userId && (
                <p className="text-xs text-destructive">{fieldErrors.userId[0]}</p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
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
