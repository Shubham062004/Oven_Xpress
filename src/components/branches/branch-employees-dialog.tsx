'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import {
  Briefcase,
  Users,
  Search,
  UserPlus,
  Loader2,
  CheckCircle2,
  Clock,
  UserX,
  Phone,
  Mail,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  getBranchEmployeesToday,
  unassignEmployeeFromBranch,
  type BranchWithManager,
  type BranchEmployeeTodayItem,
} from '@/lib/branches/actions';
import { assignBranchAndWork } from '@/lib/employees/actions';
import { APPROVED_DESIGNATIONS } from '@/lib/validations/employee';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

interface BranchEmployeesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch: BranchWithManager | null;
  onSuccess?: () => void;
}

export function BranchEmployeesDialog({
  open,
  onOpenChange,
  branch,
  onSuccess,
}: BranchEmployeesDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [employees, setEmployees] = useState<BranchEmployeeTodayItem[]>([]);
  const [unassignedEmployees, setUnassignedEmployees] = useState<
    Array<{
      id: string;
      firstName: string;
      lastName: string;
      employeeCode: string;
      designation: string;
    }>
  >([]);

  // Add staff section state
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [selectedUnassignedId, setSelectedUnassignedId] = useState('');
  const [assignDesignation, setAssignDesignation] = useState('Kitchen');

  // Change work inline state: employeeId -> selected designation
  const [editingWorkId, setEditingWorkId] = useState<string | null>(null);
  const [newWorkRole, setNewWorkRole] = useState<string>('Kitchen');

  const loadData = useCallback(() => {
    if (!branch) return;
    setLoading(true);
    getBranchEmployeesToday(branch.id)
      .then((res) => {
        if (res.success && res.data) {
          setEmployees(res.data.employees);
          setUnassignedEmployees(res.data.unassignedEmployees);
        } else {
          toast.error(res.error || 'Failed to load branch staff.');
        }
      })
      .catch(() => toast.error('Error loading branch staff.'))
      .finally(() => setLoading(false));
  }, [branch]);

  useEffect(() => {
    let active = true;
    if (open && branch) {
      getBranchEmployeesToday(branch.id).then((res) => {
        if (active && res.success && res.data) {
          setEmployees(res.data.employees);
          setUnassignedEmployees(res.data.unassignedEmployees);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [open, branch]);

  if (!branch) return null;

  // Filtered employees by search
  const filteredEmployees = employees.filter((emp) => {
    const q = search.toLowerCase();
    const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
    return (
      fullName.includes(q) ||
      emp.employeeCode.toLowerCase().includes(q) ||
      emp.designation.toLowerCase().includes(q) ||
      emp.phone.toLowerCase().includes(q)
    );
  });

  // Handle assigning an unassigned employee to this branch
  const handleAssignNewStaff = () => {
    if (!selectedUnassignedId) {
      toast.error('Please select an employee to assign.');
      return;
    }

    startTransition(async () => {
      const res = await assignBranchAndWork({
        employeeId: selectedUnassignedId,
        branchId: branch.id,
        designation: assignDesignation,
      });

      if (res.success) {
        toast.success('Staff member assigned to this branch successfully!');
        setSelectedUnassignedId('');
        setShowAddStaff(false);
        loadData();
        onSuccess?.();
      } else {
        toast.error(res.error || 'Failed to assign staff.');
      }
    });
  };

  // Handle updating an existing employee's work designation
  const handleUpdateWork = (employeeId: string) => {
    startTransition(async () => {
      const res = await assignBranchAndWork({
        employeeId,
        branchId: branch.id,
        designation: newWorkRole,
      });

      if (res.success) {
        toast.success('Work role updated successfully!');
        setEditingWorkId(null);
        loadData();
        onSuccess?.();
      } else {
        toast.error(res.error || 'Failed to update work role.');
      }
    });
  };

  // Handle removing employee from this branch
  const handleRemoveFromBranch = (employeeId: string, employeeName: string) => {
    if (!confirm(`Are you sure you want to unassign ${employeeName} from this branch?`)) {
      return;
    }

    startTransition(async () => {
      const res = await unassignEmployeeFromBranch(employeeId, branch.id);
      if (res.success) {
        toast.success(res.data?.message || 'Employee unassigned from branch.');
        loadData();
        onSuccess?.();
      } else {
        toast.error(res.error || 'Failed to unassign employee.');
      }
    });
  };

  const todayFormatted = new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="size-4.5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold flex items-center gap-2">
                <span>{branch.name} — Staff & Work</span>
                <Badge variant="outline" className="font-mono text-xs">
                  {branch.code}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                <Calendar className="size-3" />
                <span>Assigned staff and work roles for today ({todayFormatted})</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Toolbar: Search & Add Staff Toggle */}
        <div className="flex flex-col sm:flex-row gap-2.5 justify-between items-stretch sm:items-center pt-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, code, or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </div>

          <Button
            variant={showAddStaff ? 'secondary' : 'default'}
            size="sm"
            onClick={() => setShowAddStaff(!showAddStaff)}
            className="h-9 gap-1.5 text-xs shrink-0"
          >
            <UserPlus className="size-3.5" />
            <span>{showAddStaff ? 'Cancel' : 'Assign Staff to Branch'}</span>
          </Button>
        </div>

        {/* Assign Staff Panel */}
        {showAddStaff && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Briefcase className="size-3.5 text-primary" />
                Assign Staff & Work to this Branch
              </span>
            </div>

            {unassignedEmployees.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Select Unassigned Employee</Label>
                  <Select
                    value={selectedUnassignedId}
                    onValueChange={(val) => setSelectedUnassignedId(val ?? '')}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select staff member" />
                    </SelectTrigger>
                    <SelectContent>
                      {unassignedEmployees.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.firstName} {u.lastName} ({u.employeeCode})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Work / Job Role</Label>
                  <Select
                    value={assignDesignation}
                    onValueChange={(val) => setAssignDesignation(val ?? 'Kitchen')}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select work role" />
                    </SelectTrigger>
                    <SelectContent>
                      {APPROVED_DESIGNATIONS.map((desig) => (
                        <SelectItem key={desig} value={desig}>
                          {desig}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                All staff members are currently assigned to branches. Add a new employee in the Employees directory to assign them here.
              </p>
            )}

            {unassignedEmployees.length > 0 && (
              <div className="flex justify-end pt-1">
                <Button
                  size="sm"
                  onClick={handleAssignNewStaff}
                  disabled={isPending || !selectedUnassignedId}
                  className="h-8 text-xs gap-1.5"
                >
                  {isPending && <Loader2 className="size-3.5 animate-spin" />}
                  Assign to Branch
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Staff List */}
        <div className="space-y-2 pt-1">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground text-xs gap-2">
              <Loader2 className="size-4 animate-spin" />
              <span>Loading assigned staff for this branch...</span>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="rounded-lg border border-dashed py-8 text-center text-muted-foreground">
              <Users className="size-8 mx-auto opacity-30 mb-2" />
              <p className="text-sm font-medium">No staff members found</p>
              <p className="text-xs text-muted-foreground/80 mt-0.5">
                {search
                  ? 'No employees match your search query.'
                  : 'No employees are assigned to this branch yet. Use "Assign Staff" above.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1 pb-1 border-b">
                <span>{filteredEmployees.length} staff member{filteredEmployees.length !== 1 ? 's' : ''} assigned</span>
                <span>Work Role & Attendance</span>
              </div>

              {filteredEmployees.map((emp) => {
                const isEditingWork = editingWorkId === emp.id;

                return (
                  <div
                    key={emp.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-muted/20 transition-colors"
                  >
                    {/* Employee Profile */}
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {emp.firstName.charAt(0)}
                        {emp.lastName.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 font-medium text-sm text-foreground">
                          <span>
                            {emp.firstName} {emp.lastName}
                          </span>
                          <Badge variant="outline" className="font-mono text-[10px] px-1 py-0">
                            {emp.employeeCode}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <Phone className="size-3" />
                            {emp.phone}
                          </span>
                          {emp.email && (
                            <span className="hidden sm:flex items-center gap-1">
                              <Mail className="size-3" />
                              {emp.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Work Role & Attendance + Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                      {isEditingWork ? (
                        <div className="flex items-center gap-1.5">
                          <Select
                            value={newWorkRole}
                            onValueChange={(val) => setNewWorkRole(val ?? 'Kitchen')}
                          >
                            <SelectTrigger className="h-8 text-xs w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {APPROVED_DESIGNATIONS.map((d) => (
                                <SelectItem key={d} value={d}>
                                  {d}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            onClick={() => handleUpdateWork(emp.id)}
                            disabled={isPending}
                            className="h-8 px-2 text-xs"
                          >
                            Save
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingWorkId(null)}
                            className="h-8 px-2 text-xs"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {/* Work Role Badge */}
                          <Badge
                            variant="secondary"
                            className="text-xs font-medium cursor-pointer hover:bg-muted"
                            onClick={() => {
                              setEditingWorkId(emp.id);
                              setNewWorkRole(emp.designation || 'Kitchen');
                            }}
                            title="Click to change work role"
                          >
                            <Briefcase className="mr-1 size-3 text-primary" />
                            {emp.designation || 'Unassigned'}
                          </Badge>

                          {/* Today's Attendance Badge */}
                          {emp.todayAttendance ? (
                            <Badge
                              variant="outline"
                              className="text-[11px] text-green-700 dark:text-green-400 bg-green-500/10 border-green-500/30"
                            >
                              <CheckCircle2 className="mr-1 size-3" />
                              {emp.todayAttendance.checkIn
                                ? `In ${new Date(emp.todayAttendance.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                : emp.todayAttendance.status}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[11px] text-muted-foreground">
                              <Clock className="mr-1 size-3" />
                              Not checked in
                            </Badge>
                          )}

                          {/* Action to change work */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingWorkId(emp.id);
                              setNewWorkRole(emp.designation || 'Kitchen');
                            }}
                            className="h-8 text-xs px-2 text-primary hover:bg-primary/10"
                            title="Change work role"
                          >
                            Change Work
                          </Button>

                          {/* Action to unassign from branch */}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleRemoveFromBranch(emp.id, `${emp.firstName} ${emp.lastName}`)}
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Unassign from branch"
                          >
                            <UserX className="size-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
