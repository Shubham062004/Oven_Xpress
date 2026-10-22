'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  Loader2,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  RotateCcw,
  Copy,
  Check,
  KeyRound,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  createEmployee,
  updateEmployee,
  getAvailableUsersForLinking,
  resetEmployeePassword,
  createLoginAccountForExistingEmployee,
  type EmployeeItem,
  type BranchOption,
  type UserOption,
} from '@/lib/employees/actions';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  APPROVED_DESIGNATIONS,
} from '@/lib/validations/employee';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { CredentialDeliveryDialog } from '@/components/employees/credential-delivery-dialog';

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateSecurePassword(length = 12): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let result = '';
  if (typeof window !== 'undefined' && window.crypto) {
    const values = new Uint32Array(length);
    window.crypto.getRandomValues(values);
    for (let i = 0; i < length; i++) {
      result += charset[values[i] % charset.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
  }
  return result;
}

function suggestLoginEmail(firstName: string, lastName: string, personalEmail?: string): string {
  if (personalEmail && personalEmail.includes('@')) {
    return personalEmail.trim().toLowerCase();
  }
  const cleanFirst = firstName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanLast = lastName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (cleanFirst && cleanLast) {
    return `${cleanFirst}.${cleanLast}@ovenxpress.com`;
  }
  if (cleanFirst) {
    return `${cleanFirst}@ovenxpress.com`;
  }
  return '';
}

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

  // ─── Base Form State ───────────────────────────────────────────────────────
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
    designation: employee?.designation ?? APPROVED_DESIGNATIONS[0],
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

  // ─── Inline Account Creation State (Add Mode) ──────────────────────────────
  const [createLoginAccount, setCreateLoginAccount] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copiedCredentials, setCopiedCredentials] = useState(false);

  // ─── Account & Security State (Edit Mode) ──────────────────────────────────
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetNewPassword, setShowResetNewPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Create account for existing unlinked employee
  const [showCreateAccountForExisting, setShowCreateAccountForExisting] = useState(false);
  const [existingLoginEmail, setExistingLoginEmail] = useState('');
  const [existingLoginPassword, setExistingLoginPassword] = useState('');
  const [existingConfirmPassword, setExistingConfirmPassword] = useState('');
  const [showExistingPassword, setShowExistingPassword] = useState(false);
  const [isCreatingExistingAccount, setIsCreatingExistingAccount] = useState(false);

  // ─── Credential Delivery Modal State ───────────────────────────────────────
  const [deliveryDialogData, setDeliveryDialogData] = useState<{
    open: boolean;
    employeeName: string;
    loginId: string;
    temporaryPassword: string;
  }>({
    open: false,
    employeeName: '',
    loginId: '',
    temporaryPassword: '',
  });

  // Designation options: strictly approved designations only
  const designationOptions = APPROVED_DESIGNATIONS;

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

  // Auto-generate credentials when toggle is switched ON in Add Mode
  const handleToggleCreateAccount = (checked: boolean) => {
    setCreateLoginAccount(checked);
    if (checked) {
      if (!loginEmail) {
        setLoginEmail(suggestLoginEmail(formData.firstName, formData.lastName, formData.email));
      }
      if (!loginPassword) {
        const pass = generateSecurePassword(12);
        setLoginPassword(pass);
        setConfirmPassword(pass);
      }
    }
  };

  const handleRegeneratePassword = () => {
    const pass = generateSecurePassword(12);
    setLoginPassword(pass);
    setConfirmPassword(pass);
    toast.success('Generated new secure temporary password');
  };

  const handleRegenerateResetPassword = () => {
    const pass = generateSecurePassword(12);
    setResetNewPassword(pass);
    setResetConfirmPassword(pass);
    toast.success('Generated new secure temporary password');
  };

  const handleRegenerateExistingPassword = () => {
    const pass = generateSecurePassword(12);
    setExistingLoginPassword(pass);
    setExistingConfirmPassword(pass);
    toast.success('Generated new secure temporary password');
  };

  const handleCopyCredentials = async () => {
    try {
      const text = `Oven Xpress Staff Credentials\nLogin ID / Email: ${loginEmail}\nTemporary Password: ${loginPassword}`;
      await navigator.clipboard.writeText(text);
      setCopiedCredentials(true);
      toast.success('Credentials copied to clipboard');
      setTimeout(() => setCopiedCredentials(false), 2000);
    } catch {
      toast.error('Failed to copy credentials');
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      // Auto-update suggested email if not yet manually modified
      if (!isEditing && createLoginAccount && (field === 'firstName' || field === 'lastName' || field === 'email')) {
        const suggested = suggestLoginEmail(
          field === 'firstName' ? value : next.firstName,
          field === 'lastName' ? value : next.lastName,
          field === 'email' ? value : next.email
        );
        if (suggested && (!loginEmail || loginEmail.endsWith('@ovenxpress.com'))) {
          setLoginEmail(suggested);
        }
      }
      return next;
    });

    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (formError) setFormError(null);
  };

  // ─── Reset Password Handler (Edit Mode) ────────────────────────────────────

  const handleSaveResetPassword = async () => {
    if (!employee || !employee.id) return;

    if (!resetNewPassword || resetNewPassword.length < 8) {
      toast.error('Temporary password must be at least 8 characters long');
      return;
    }

    if (resetNewPassword !== resetConfirmPassword) {
      toast.error('Password confirmation does not match');
      return;
    }

    setIsResetting(true);
    try {
      const result = await resetEmployeePassword(
        employee.id,
        resetNewPassword,
        resetConfirmPassword
      );

      if (result.success) {
        toast.success(result.message || 'Password reset successfully');
        setShowResetPassword(false);
        setDeliveryDialogData({
          open: true,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          loginId: employee.user?.email || employee.email || 'Linked Account',
          temporaryPassword: resetNewPassword,
        });
        setResetNewPassword('');
        setResetConfirmPassword('');
      } else {
        toast.error(result.error ?? 'Failed to reset password');
      }
    } catch {
      toast.error('An unexpected error occurred while resetting password');
    } finally {
      setIsResetting(false);
    }
  };

  // ─── Create Login for Existing Unlinked Employee ───────────────────────────

  const handleCreateAccountForExisting = async () => {
    if (!employee || !employee.id) return;

    if (!existingLoginEmail || !existingLoginEmail.includes('@')) {
      toast.error('Please enter a valid login email address');
      return;
    }

    if (!existingLoginPassword || existingLoginPassword.length < 8) {
      toast.error('Temporary password must be at least 8 characters long');
      return;
    }

    if (existingLoginPassword !== existingConfirmPassword) {
      toast.error('Password confirmation does not match');
      return;
    }

    setIsCreatingExistingAccount(true);
    try {
      const result = await createLoginAccountForExistingEmployee(
        employee.id,
        existingLoginEmail,
        existingLoginPassword,
        existingConfirmPassword
      );

      if (result.success && result.data) {
        toast.success(result.message || 'Account created successfully');
        setShowCreateAccountForExisting(false);
        setDeliveryDialogData({
          open: true,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          loginId: result.data.loginId,
          temporaryPassword: result.data.temporaryPassword,
        });
        onSuccess();
      } else {
        toast.error(result.error ?? 'Failed to create login account');
      }
    } catch {
      toast.error('An unexpected error occurred while creating the account');
    } finally {
      setIsCreatingExistingAccount(false);
    }
  };

  // ─── Client-side Validation ─────────────────────────────────────────────

  const validateClient = (): boolean => {
    const payload = {
      ...formData,
      salary: formData.salary ? Number(formData.salary) : 0,
      userId: formData.userId === 'NONE' || formData.userId === '' ? null : formData.userId,
      createLoginAccount: !isEditing ? createLoginAccount : false,
      loginEmail: !isEditing && createLoginAccount ? loginEmail : undefined,
      loginPassword: !isEditing && createLoginAccount ? loginPassword : undefined,
      confirmPassword: !isEditing && createLoginAccount ? confirmPassword : undefined,
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
      createLoginAccount: !isEditing ? createLoginAccount : false,
      loginEmail: !isEditing && createLoginAccount ? loginEmail.trim() : undefined,
      loginPassword: !isEditing && createLoginAccount ? loginPassword : undefined,
      confirmPassword: !isEditing && createLoginAccount ? confirmPassword : undefined,
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

        // If credentials were generated, pop the one-time delivery dialog
        if (result.createdCredentials) {
          setDeliveryDialogData({
            open: true,
            employeeName: `${result.data?.firstName} ${result.data?.lastName}`,
            loginId: result.createdCredentials.loginId,
            temporaryPassword: result.createdCredentials.temporaryPassword,
          });
        }
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
    <>
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

                {/* Designation Dropdown */}
                <div className="space-y-1.5">
                  <Label htmlFor="emp-designation">
                    Job Designation <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.designation}
                    onValueChange={(val) => updateField('designation', val ?? '')}
                  >
                    <SelectTrigger id="emp-designation" className="w-full" disabled={isPending}>
                      <SelectValue placeholder="Select Designation" />
                    </SelectTrigger>
                    <SelectContent>
                      {designationOptions.map((desig) => (
                        <SelectItem key={desig} value={desig}>
                          {desig}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

            {/* Section 4: Emergency Contact & System Account */}
            <div className="space-y-4">
              <h3 className="border-b pb-1 text-sm font-semibold text-foreground">
                {isEditing ? '4. Emergency Contact & Account Security' : '4. Emergency Contact & Account Linking'}
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

              {/* Account Linking or Creation (ADD MODE) */}
              {!isEditing && (
                <div className="space-y-3 rounded-lg border border-border/80 bg-muted/20 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <KeyRound className="size-4 text-primary" />
                      <Label htmlFor="create-account-toggle" className="font-medium cursor-pointer">
                        Create System Login Account
                      </Label>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        id="create-account-toggle"
                        checked={createLoginAccount}
                        onChange={(e) => handleToggleCreateAccount(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    When enabled, generates secure login credentials for this employee. Roles are assigned using least privilege (Branch Managers get MANAGER, others get STAFF).
                  </p>

                  {createLoginAccount ? (
                    <div className="space-y-3 pt-2 border-t border-border/60">
                      {/* Login ID */}
                      <div className="space-y-1.5">
                        <Label htmlFor="login-email">
                          Username / Login ID (Email) <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="login-email"
                          type="email"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          placeholder="example@gmail.com"
                          className="font-mono text-xs"
                          aria-invalid={!!fieldErrors.loginEmail}
                        />
                        {fieldErrors.loginEmail && (
                          <p className="text-xs text-destructive">{fieldErrors.loginEmail[0]}</p>
                        )}
                      </div>

                      {/* Temporary Password & Controls */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="login-password">
                            Temporary Password <span className="text-destructive">*</span>
                          </Label>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={handleRegeneratePassword}
                              className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                            >
                              <RotateCcw className="mr-1 size-3" />
                              Regenerate
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={handleCopyCredentials}
                              className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                            >
                              {copiedCredentials ? (
                                <Check className="mr-1 size-3 text-green-600" />
                              ) : (
                                <Copy className="mr-1 size-3" />
                              )}
                              Copy
                            </Button>
                          </div>
                        </div>
                        <div className="relative">
                          <Input
                            id="login-password"
                            type={showPassword ? 'text' : 'password'}
                            value={loginPassword}
                            onChange={(e) => {
                              setLoginPassword(e.target.value);
                              setConfirmPassword(e.target.value);
                            }}
                            placeholder="Enter or generate temporary password"
                            className="font-mono pr-10"
                            aria-invalid={!!fieldErrors.loginPassword}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </button>
                        </div>
                        {fieldErrors.loginPassword && (
                          <p className="text-xs text-destructive">{fieldErrors.loginPassword[0]}</p>
                        )}
                      </div>

                      {/* Confirm Password */}
                      <div className="space-y-1.5">
                        <Label htmlFor="login-confirmPassword">
                          Confirm Password <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="login-confirmPassword"
                          type={showPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm temporary password"
                          className="font-mono"
                          aria-invalid={!!fieldErrors.confirmPassword}
                        />
                        {fieldErrors.confirmPassword && (
                          <p className="text-xs text-destructive">{fieldErrors.confirmPassword[0]}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-border/40">
                      <Label htmlFor="emp-userId" className="text-xs font-medium text-muted-foreground">
                        Or Link Existing System Account (Optional)
                      </Label>
                      <Select
                        value={formData.userId || 'NONE'}
                        onValueChange={(val) => updateField('userId', val === 'NONE' ? '' : (val ?? ''))}
                      >
                        <SelectTrigger id="emp-userId" className="w-full mt-1.5" disabled={isPending}>
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
                    </div>
                  )}
                </div>
              )}

              {/* Account & Security (EDIT MODE) */}
              {isEditing && (
                <div className="space-y-3 rounded-lg border border-border/80 bg-muted/20 p-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-primary" />
                    <h4 className="font-semibold text-sm">Account & Security</h4>
                  </div>

                  {employee?.user ? (
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-md border bg-background p-3 text-xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-medium text-sm text-foreground">
                              {employee.user.email}
                            </span>
                            <Badge variant="outline" className="text-[10px] uppercase">
                              {employee.user.role.name}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground">
                            System login account is currently{' '}
                            <span className={employee.employmentStatus === 'ACTIVE' ? 'text-green-600 font-medium' : 'text-amber-600 font-medium'}>
                              {employee.employmentStatus === 'ACTIVE' ? 'Active' : 'Disabled'}
                            </span>
                          </p>
                        </div>

                        {!showResetPassword && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setShowResetPassword(true);
                              const pass = generateSecurePassword(12);
                              setResetNewPassword(pass);
                              setResetConfirmPassword(pass);
                            }}
                            className="shrink-0"
                          >
                            <Lock className="mr-1.5 size-3.5" />
                            Reset Password
                          </Button>
                        )}
                      </div>

                      {/* Reset Password Form */}
                      {showResetPassword && (
                        <div className="space-y-3 rounded-md border border-primary/20 bg-primary/5 p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-foreground">
                              Set New Password
                            </span>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleRegenerateResetPassword}
                                className="h-6 text-xs px-1.5 text-muted-foreground hover:text-foreground"
                              >
                                <RotateCcw className="mr-1 size-3" />
                                Regenerate
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowResetPassword(false)}
                                className="h-6 text-xs px-1.5"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="relative">
                              <Input
                                type={showResetNewPassword ? 'text' : 'password'}
                                value={resetNewPassword}
                                onChange={(e) => {
                                  setResetNewPassword(e.target.value);
                                  setResetConfirmPassword(e.target.value);
                                }}
                                placeholder="Enter secure new password"
                                className="font-mono pr-10 text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => setShowResetNewPassword(!showResetNewPassword)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                aria-label={showResetNewPassword ? 'Hide password' : 'Show password'}
                              >
                                {showResetNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                              </button>
                            </div>

                            <Input
                              type={showResetNewPassword ? 'text' : 'password'}
                              value={resetConfirmPassword}
                              onChange={(e) => setResetConfirmPassword(e.target.value)}
                              placeholder="Confirm new password"
                              className="font-mono text-xs"
                            />
                          </div>

                          <p className="text-[11px] text-muted-foreground">
                            Saving a new password invalidates all existing active sessions for this account.
                          </p>

                          <div className="flex justify-end gap-2 pt-1">
                            <Button
                              type="button"
                              size="sm"
                              onClick={handleSaveResetPassword}
                              disabled={isResetting}
                              className="h-8 text-xs"
                            >
                              {isResetting && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                              Save New Password
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between rounded-md border bg-background p-3 text-xs">
                        <div>
                          <p className="font-medium text-foreground">No Login Account Linked</p>
                          <p className="text-muted-foreground">
                            This employee does not currently have system access.
                          </p>
                        </div>
                        {!showCreateAccountForExisting && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setShowCreateAccountForExisting(true);
                              setExistingLoginEmail(
                                suggestLoginEmail(formData.firstName, formData.lastName, formData.email)
                              );
                              const pass = generateSecurePassword(12);
                              setExistingLoginPassword(pass);
                              setExistingConfirmPassword(pass);
                            }}
                          >
                            <KeyRound className="mr-1.5 size-3.5" />
                            Create Login Account
                          </Button>
                        )}
                      </div>

                      {showCreateAccountForExisting && (
                        <div className="space-y-3 rounded-md border border-primary/20 bg-primary/5 p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-foreground">
                              Create System Credentials
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowCreateAccountForExisting(false)}
                              className="h-6 text-xs px-1.5"
                            >
                              Cancel
                            </Button>
                          </div>

                          <div className="space-y-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Login ID / Email</Label>
                              <Input
                                type="email"
                                value={existingLoginEmail}
                                onChange={(e) => setExistingLoginEmail(e.target.value)}
                                placeholder="example@gmail.com"
                                className="font-mono text-xs"
                              />
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs">Temporary Password</Label>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleRegenerateExistingPassword}
                                  className="h-5 text-xs px-1 text-muted-foreground hover:text-foreground"
                                >
                                  <RotateCcw className="mr-1 size-3" />
                                  Regenerate
                                </Button>
                              </div>
                              <div className="relative">
                                <Input
                                  type={showExistingPassword ? 'text' : 'password'}
                                  value={existingLoginPassword}
                                  onChange={(e) => {
                                    setExistingLoginPassword(e.target.value);
                                    setExistingConfirmPassword(e.target.value);
                                  }}
                                  placeholder="Temporary password"
                                  className="font-mono pr-10 text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowExistingPassword(!showExistingPassword)}
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                  aria-label={showExistingPassword ? 'Hide password' : 'Show password'}
                                >
                                  {showExistingPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                </button>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs">Confirm Password</Label>
                              <Input
                                type={showExistingPassword ? 'text' : 'password'}
                                value={existingConfirmPassword}
                                onChange={(e) => setExistingConfirmPassword(e.target.value)}
                                placeholder="Confirm password"
                                className="font-mono text-xs"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-1">
                            <Button
                              type="button"
                              size="sm"
                              onClick={handleCreateAccountForExisting}
                              disabled={isCreatingExistingAccount}
                              className="h-8 text-xs"
                            >
                              {isCreatingExistingAccount && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                              Create & Link Account
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
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

      {/* One-time Credential Delivery Dialog */}
      <CredentialDeliveryDialog
        open={deliveryDialogData.open}
        onOpenChange={(open) => setDeliveryDialogData((prev) => ({ ...prev, open }))}
        employeeName={deliveryDialogData.employeeName}
        loginId={deliveryDialogData.loginId}
        temporaryPassword={deliveryDialogData.temporaryPassword}
      />
    </>
  );
}
