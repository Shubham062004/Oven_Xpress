'use client';

import { useState, useTransition, useRef } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import {
  Building2,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Globe,
  HardDrive,
  Info,
  KeyRound,
  Laptop,
  Lock,
  LogOut,
  Mail,
  Moon,
  Phone,
  Save,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Smartphone,
  Sun,
  Trash2,
  User as UserIcon,
  XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  type ProfileDetails,
  updateProfileAction,
  changePasswordAction,
  revokeOtherSessionsAction,
} from '@/lib/profile/profile-actions';
import { updateUserPreferencesAction } from '@/lib/settings/actions';
import { logoutAction } from '@/lib/auth/actions';

interface ProfileClientProps {
  initialData: ProfileDetails;
  initialTab?: string;
  allBranches?: { id: string; name: string }[];
}

function getInitials(name?: string): string {
  if (!name) return 'OX';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function parseDevice(userAgent?: string | null): { name: string; isMobile: boolean } {
  if (!userAgent) return { name: 'Unknown Device', isMobile: false };
  const ua = userAgent.toLowerCase();
  const isMobile = ua.includes('mobile') || ua.includes('android') || ua.includes('iphone');

  let browser = 'Browser';
  if (ua.includes('brave')) browser = 'Brave';
  else if (ua.includes('chrome')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('edg')) browser = 'Edge';

  let os = 'OS';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('macintosh') || ua.includes('mac os')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('ios') || ua.includes('iphone')) os = 'iOS';

  return { name: `${browser} on ${os}`, isMobile };
}

export function ProfileClient({
  initialData,
  initialTab = 'overview',
  allBranches = [],
}: ProfileClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryTab = searchParams.get('tab') || initialTab;

  const validTabs = ['overview', 'edit', 'security', 'preferences', 'account'];
  const activeTab = validTabs.includes(queryTab)
    ? queryTab === 'account'
      ? 'overview'
      : queryTab
    : 'overview';

  const [tab, setTab] = useState<string>(activeTab);
  const [profileData, setProfileData] = useState<ProfileDetails>(initialData);
  const [isPending, startTransition] = useTransition();
  const { theme, setTheme } = useTheme();

  // Split name for edit form
  const nameParts = (profileData.user.name || '').trim().split(/\s+/);
  const initialFirstName = nameParts[0] || '';
  const initialLastName = nameParts.slice(1).join(' ') || '';

  // Edit profile form state
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [phone, setPhone] = useState(profileData.user.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(profileData.user.avatarUrl || '');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password change form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Preferences form state
  const [tableDensity, setTableDensity] = useState(
    profileData.preferences.tableDensity || 'comfortable'
  );
  const [defaultDateRange, setDefaultDateRange] = useState(
    profileData.preferences.defaultDateRange || '30d'
  );
  const [preferredBranchId, setPreferredBranchId] = useState<string | null>(
    profileData.preferences.preferredBranchId
  );

  const handleTabChange = (newTab: string) => {
    setTab(newTab);
    router.replace(`/profile?tab=${newTab}`, { scroll: false });
  };

  // Password Complexity Validation Rules
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
  const isDifferent = currentPassword !== '' && newPassword !== '' && currentPassword !== newPassword;
  const passwordsMatch = newPassword !== '' && newPassword === confirmPassword;

  const isPasswordFormValid =
    hasMinLength &&
    hasUppercase &&
    hasLowercase &&
    hasNumber &&
    hasSpecial &&
    isDifferent &&
    passwordsMatch &&
    currentPassword.length > 0;

  // Handle Avatar Upload
  const handleAvatarFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (JPG, PNG, WEBP).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Avatar file size cannot exceed 2MB.');
      return;
    }

    setIsUploadingAvatar(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/uploads/avatar', {
        method: 'POST',
        body: formData,
      });

      const res = await response.json();
      if (!response.ok || !res.success) {
        throw new Error(res.error || 'Failed to upload avatar.');
      }

      setAvatarUrl(res.url);

      // Auto-save the new avatar to user record
      const updateResult = await updateProfileAction({
        firstName,
        lastName,
        phone,
        avatarUrl: res.url,
      });

      if (updateResult.success) {
        setProfileData((prev) => ({
          ...prev,
          user: {
            ...prev.user,
            avatarUrl: res.url,
          },
        }));
        toast.success('Avatar updated successfully!');
        router.refresh();
      } else {
        toast.error(updateResult.error || 'Failed to link avatar.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      toast.error(message);
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    setIsUploadingAvatar(true);
    try {
      const updateResult = await updateProfileAction({
        firstName,
        lastName,
        phone,
        avatarUrl: null,
      });

      if (updateResult.success) {
        setAvatarUrl('');
        setProfileData((prev) => ({
          ...prev,
          user: {
            ...prev.user,
            avatarUrl: null,
          },
        }));
        toast.success('Avatar removed. Initials will be used.');
        router.refresh();
      } else {
        toast.error(updateResult.error || 'Failed to remove avatar.');
      }
    } catch {
      toast.error('Failed to remove avatar.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Handle Profile Update Submission
  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('First and last name are required.');
      return;
    }

    startTransition(async () => {
      const res = await updateProfileAction({
        firstName,
        lastName,
        phone,
        avatarUrl,
      });

      if (!res.success) {
        toast.error(res.error || 'Failed to update profile.');
        return;
      }

      const updatedFullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      setProfileData((prev) => ({
        ...prev,
        user: {
          ...prev.user,
          name: updatedFullName,
          phone: res.data?.phone || null,
          avatarUrl: res.data?.avatarUrl || null,
          updatedAt: new Date(),
        },
        employee: prev.employee
          ? {
              ...prev.employee,
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              phone: res.data?.phone || prev.employee.phone,
            }
          : null,
      }));

      toast.success('Profile updated successfully!');
      router.refresh();
    });
  };

  // Handle Password Change Submission
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordFormValid) {
      toast.error('Please fulfill all password requirements.');
      return;
    }

    startTransition(async () => {
      const res = await changePasswordAction({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      if (!res.success) {
        toast.error(res.error || 'Failed to change password.');
        return;
      }

      toast.success('Password changed successfully! Other active sessions have been revoked.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setProfileData((prev) => ({
        ...prev,
        user: {
          ...prev.user,
          passwordChangedAt: new Date(),
        },
        activeSessions: prev.activeSessions.filter((s) => s.isCurrent),
      }));
      router.refresh();
    });
  };

  // Handle Revoking Other Sessions
  const handleRevokeOtherSessions = () => {
    startTransition(async () => {
      const res = await revokeOtherSessionsAction();
      if (!res.success) {
        toast.error(res.error || 'Failed to revoke other sessions.');
        return;
      }

      const count = res.data?.revokedCount || 0;
      toast.success(`Successfully signed out of ${count} other active session(s).`);
      setProfileData((prev) => ({
        ...prev,
        activeSessions: prev.activeSessions.filter((s) => s.isCurrent),
      }));
      router.refresh();
    });
  };

  // Handle User Preferences Update
  const handlePreferencesSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateUserPreferencesAction({
        theme: (theme as 'light' | 'dark' | 'system') || 'system',
        tableDensity: tableDensity as 'compact' | 'comfortable',
        defaultDateRange: defaultDateRange as 'today' | 'yesterday' | '7d' | '30d' | '90d',
        preferredBranchId: preferredBranchId || null,
      });

      if (!res.success) {
        toast.error(res.error || 'Failed to update preferences.');
        return;
      }

      toast.success('Preferences saved successfully!');
      router.refresh();
    });
  };

  const getRoleVariant = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'default';
      case 'ADMIN':
        return 'secondary';
      case 'MANAGER':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const otherSessionsCount = profileData.activeSessions.filter((s) => !s.isCurrent).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* TOP HERO PROFILE BANNER                                      */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Card className="overflow-hidden border-border/80 shadow-xs">
        <div className="h-28 bg-linear-to-r from-primary/10 via-primary/5 to-muted border-b" />
        <CardContent className="px-6 pb-6 pt-0 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-14 mb-4">
            {/* Avatar & Identifiers */}
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
              <div className="relative group">
                <div className="size-24 rounded-full bg-background p-1 shadow-md ring-2 ring-primary/20 overflow-hidden">
                  <div className="size-full rounded-full bg-primary/15 text-primary text-2xl font-bold flex items-center justify-center overflow-hidden">
                    {profileData.user.avatarUrl ? (
                      <Image
                        src={profileData.user.avatarUrl}
                        alt={profileData.user.name}
                        width={96}
                        height={96}
                        className="size-full object-cover"
                        unoptimized
                      />
                    ) : (
                      getInitials(profileData.user.name)
                    )}
                  </div>
                </div>

                {/* Upload Avatar Quick Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  className="absolute bottom-1 right-1 size-7 rounded-full bg-primary text-primary-foreground shadow-md flex items-center justify-center hover:bg-primary/90 transition-transform active:scale-95 focus-visible:outline-none"
                  title="Upload profile picture"
                  aria-label="Upload profile picture"
                >
                  <Camera className="size-3.5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAvatarFileSelected}
                />
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                    {profileData.user.name}
                  </h1>
                  <Badge variant={getRoleVariant(profileData.user.role)} className="font-semibold text-xs px-2 py-0.5">
                    {profileData.user.role}
                  </Badge>
                  {profileData.user.isActive ? (
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-[11px] gap-1 px-2 py-0.5">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="text-[11px]">
                      Deactivated
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Mail className="size-3.5" />
                    {profileData.user.email}
                  </span>
                  {profileData.user.phone ? (
                    <span className="flex items-center gap-1.5">
                      <Phone className="size-3.5" />
                      {profileData.user.phone}
                    </span>
                  ) : null}
                  {profileData.employee ? (
                    <span className="flex items-center gap-1.5 font-medium text-foreground/80">
                      <Building2 className="size-3.5" />
                      {profileData.employee.branch.name} ({profileData.employee.designation})
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 font-medium text-foreground/80">
                      <Globe className="size-3.5" />
                      Corporate Universal Access
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Action Button */}
            <div className="flex items-center gap-2">
              <form action={logoutAction}>
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
                >
                  <LogOut className="size-3.5" />
                  Sign Out
                </Button>
              </form>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TABBED NAVIGATION & DETAILED SECTIONS                         */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Tabs value={tab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full h-auto p-1 bg-muted/60">
          <TabsTrigger value="overview" className="gap-2 py-2 text-xs sm:text-sm">
            <UserIcon className="size-4" />
            <span>Profile Overview</span>
          </TabsTrigger>
          <TabsTrigger value="edit" className="gap-2 py-2 text-xs sm:text-sm">
            <Save className="size-4" />
            <span>Edit Profile</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2 py-2 text-xs sm:text-sm relative">
            <Shield className="size-4" />
            <span>Password & Security</span>
            {otherSessionsCount > 0 ? (
              <span className="ml-1 size-2 rounded-full bg-primary" />
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2 py-2 text-xs sm:text-sm">
            <Sliders className="size-4" />
            <span>Preferences</span>
          </TabsTrigger>
        </TabsList>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* TAB 1: OVERVIEW                                               */}
        {/* ───────────────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-6 outline-none">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Personal Information */}
            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserIcon className="size-4 text-primary" />
                  Personal Information
                </CardTitle>
                <CardDescription>
                  Your individual identity and contact credentials
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground uppercase font-medium">First Name</span>
                    <p className="text-sm font-semibold text-foreground mt-0.5">
                      {initialFirstName || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground uppercase font-medium">Last Name</span>
                    <p className="text-sm font-semibold text-foreground mt-0.5">
                      {initialLastName || '—'}
                    </p>
                  </div>
                </div>

                <Separator />

                <div>
                  <span className="text-xs text-muted-foreground uppercase font-medium">Email Address</span>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-sm font-semibold text-foreground">
                      {profileData.user.email}
                    </p>
                    {profileData.user.emailVerified ? (
                      <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 bg-emerald-500/10 text-[10px] gap-1">
                        <Check className="size-3" /> Verified
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 bg-amber-500/10 text-[10px]">
                        Unverified
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                    <Info className="size-3 shrink-0" />
                    Contact an administrator to change your account email.
                  </p>
                </div>

                <Separator />

                <div>
                  <span className="text-xs text-muted-foreground uppercase font-medium">Phone Number</span>
                  <p className="text-sm font-semibold text-foreground mt-0.5">
                    {profileData.user.phone || 'No phone number provided'}
                  </p>
                </div>
              </CardContent>
              <CardFooter className="pt-3 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTabChange('edit')}
                  className="w-full text-xs"
                >
                  Edit Personal Details
                </Button>
              </CardFooter>
            </Card>

            {/* Employment / Organizational Context */}
            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="size-4 text-primary" />
                  Employment & Branch Context
                </CardTitle>
                <CardDescription>
                  Your operational assignment and employment records
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {profileData.employee ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-xs text-muted-foreground uppercase font-medium">Employee Code</span>
                        <p className="text-sm font-mono font-semibold text-foreground mt-0.5">
                          {profileData.employee.employeeCode}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground uppercase font-medium">Designation</span>
                        <p className="text-sm font-semibold text-foreground mt-0.5">
                          {profileData.employee.designation}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <span className="text-xs text-muted-foreground uppercase font-medium">Assigned Branch</span>
                      <p className="text-sm font-semibold text-foreground mt-0.5">
                        {profileData.employee.branch.name} ({profileData.employee.branch.code})
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {profileData.employee.branch.address}, {profileData.employee.branch.city}
                      </p>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-xs text-muted-foreground uppercase font-medium">Joining Date</span>
                        <p className="text-sm font-semibold text-foreground mt-0.5">
                          {new Date(profileData.employee.joiningDate).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground uppercase font-medium">Employment Status</span>
                        <div className="mt-0.5">
                          <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 bg-emerald-500/10 text-xs">
                            {profileData.employee.employmentStatus}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="py-6 text-center space-y-3">
                    <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                      <Shield className="size-6" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold">Corporate Administrator Profile</h2>
                      <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-1">
                        Your account operates as an organization-level administrator with universal multi-branch authority. No localized employee record is linked.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Account Metadata & Security Overview */}
            <Card className="md:col-span-2">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary" />
                  Account Security & Identity Status
                </CardTitle>
                <CardDescription>
                  Audit timestamps and account lifecycle metadata
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase font-medium flex items-center gap-1">
                      <Calendar className="size-3.5" /> Account Created
                    </span>
                    <p className="text-xs font-semibold text-foreground">
                      {new Date(profileData.user.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase font-medium flex items-center gap-1">
                      <Clock className="size-3.5" /> Last Updated
                    </span>
                    <p className="text-xs font-semibold text-foreground">
                      {new Date(profileData.user.updatedAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase font-medium flex items-center gap-1">
                      <KeyRound className="size-3.5" /> Password Changed
                    </span>
                    <p className="text-xs font-semibold text-foreground">
                      {profileData.user.passwordChangedAt
                        ? new Date(profileData.user.passwordChangedAt).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'Default seed password'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase font-medium flex items-center gap-1">
                      <HardDrive className="size-3.5" /> Active Sessions
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className="text-xs">
                        {profileData.activeSessions.length} active
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* TAB 2: EDIT PROFILE                                           */}
        {/* ───────────────────────────────────────────────────────────── */}
        <TabsContent value="edit" className="outline-none">
          <Card>
            <form onSubmit={handleProfileSubmit}>
              <CardHeader className="border-b">
                <CardTitle className="text-base">Edit Profile Information</CardTitle>
                <CardDescription>
                  Update your display name, contact phone number, and avatar image.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {/* Administrative restrictions warning banner */}
                <Alert className="bg-muted/50 border-border">
                  <ShieldAlert className="size-4 text-muted-foreground" />
                  <AlertTitle className="text-xs font-semibold">Strict Role & Branch Isolation</AlertTitle>
                  <AlertDescription className="text-xs text-muted-foreground">
                    Role assignments, branch affiliations, employee codes, and salary information are strictly managed by restaurant administrators and cannot be self-modified.
                  </AlertDescription>
                </Alert>

                {/* Avatar Management Section */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Profile Photo</Label>
                  <div className="flex items-center gap-4">
                    <div className="relative size-16 rounded-full bg-primary/15 text-primary text-xl font-bold flex items-center justify-center overflow-hidden border">
                      {avatarUrl ? (
                        <Image
                          src={avatarUrl}
                          alt="Avatar preview"
                          width={64}
                          height={64}
                          className="size-full object-cover"
                          unoptimized
                        />
                      ) : (
                        getInitials(`${firstName} ${lastName}`)
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingAvatar || isPending}
                          className="text-xs gap-1.5"
                        >
                          <Camera className="size-3.5" />
                          {isUploadingAvatar ? 'Uploading...' : 'Upload New Photo'}
                        </Button>
                        {avatarUrl ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleRemoveAvatar}
                            disabled={isUploadingAvatar || isPending}
                            className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive gap-1"
                          >
                            <Trash2 className="size-3.5" />
                            Remove
                          </Button>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Supported formats: JPG, PNG, WEBP. Maximum file size: 2MB. Uploads are stored securely in Azure Blob Storage.
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Name Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-xs font-semibold">
                      First Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="e.g. John"
                      required
                      maxLength={50}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-xs font-semibold">
                      Last Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="e.g. Doe"
                      required
                      maxLength={50}
                    />
                  </div>
                </div>

                {/* Phone & Email Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-xs font-semibold">
                      Phone Number
                    </Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      maxLength={20}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-xs font-semibold">
                      Email Address (Read-only)
                    </Label>
                    <Input
                      id="email"
                      value={profileData.user.email}
                      disabled
                      className="bg-muted text-muted-foreground cursor-not-allowed"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Email address changes must be handled through administrative channels.
                    </p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFirstName(initialFirstName);
                    setLastName(initialLastName);
                    setPhone(profileData.user.phone || '');
                    handleTabChange('overview');
                  }}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isPending} className="gap-2">
                  <Save className="size-4" />
                  {isPending ? 'Saving...' : 'Save Profile Changes'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* TAB 3: PASSWORD & SECURITY                                    */}
        {/* ───────────────────────────────────────────────────────────── */}
        <TabsContent value="security" className="space-y-6 outline-none">
          {/* Change Password Card */}
          <Card>
            <form onSubmit={handlePasswordSubmit}>
              <CardHeader className="border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <KeyRound className="size-4 text-primary" />
                  Change Password
                </CardTitle>
                <CardDescription>
                  Ensure your account is protected with an enterprise-grade high-entropy password.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {/* Current Password */}
                <div className="space-y-2">
                  <Label htmlFor="currentPassword" className="text-xs font-semibold">
                    Current Password <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter your current password"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label="Toggle current password visibility"
                    >
                      {showCurrentPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-xs font-semibold">
                    New Password <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Create a strong new password"
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label="Toggle new password visibility"
                    >
                      {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm New Password */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-xs font-semibold">
                    Confirm New Password <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat your new password"
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label="Toggle confirm password visibility"
                    >
                      {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {/* Real-time Password Complexity Checklist */}
                <div className="rounded-lg border bg-muted/30 p-3.5 space-y-2 text-xs">
                  <p className="font-semibold text-foreground flex items-center gap-1.5">
                    <Lock className="size-3.5 text-primary" /> Password Requirements:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      {hasMinLength ? <CheckCircle2 className="size-3.5 text-emerald-500" /> : <XCircle className="size-3.5 text-muted-foreground" />}
                      <span className={hasMinLength ? 'text-foreground font-medium' : ''}>At least 8 characters</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {hasUppercase ? <CheckCircle2 className="size-3.5 text-emerald-500" /> : <XCircle className="size-3.5 text-muted-foreground" />}
                      <span className={hasUppercase ? 'text-foreground font-medium' : ''}>Uppercase letter (A-Z)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {hasLowercase ? <CheckCircle2 className="size-3.5 text-emerald-500" /> : <XCircle className="size-3.5 text-muted-foreground" />}
                      <span className={hasLowercase ? 'text-foreground font-medium' : ''}>Lowercase letter (a-z)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {hasNumber ? <CheckCircle2 className="size-3.5 text-emerald-500" /> : <XCircle className="size-3.5 text-muted-foreground" />}
                      <span className={hasNumber ? 'text-foreground font-medium' : ''}>At least one number (0-9)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {hasSpecial ? <CheckCircle2 className="size-3.5 text-emerald-500" /> : <XCircle className="size-3.5 text-muted-foreground" />}
                      <span className={hasSpecial ? 'text-foreground font-medium' : ''}>Special character (!@#$%^&*)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {passwordsMatch ? <CheckCircle2 className="size-3.5 text-emerald-500" /> : <XCircle className="size-3.5 text-muted-foreground" />}
                      <span className={passwordsMatch ? 'text-foreground font-medium' : ''}>Passwords match</span>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Security notice: When your password is changed, all other active sessions across devices will be automatically revoked. Your current session will remain active.
                </p>
              </CardContent>
              <CardFooter className="border-t flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  disabled={!isPasswordFormValid || isPending}
                  className="gap-2"
                >
                  <Lock className="size-4" />
                  {isPending ? 'Updating Password...' : 'Update Password'}
                </Button>
              </CardFooter>
            </form>
          </Card>

          {/* Active Sessions & Security Revocation */}
          <Card>
            <CardHeader className="border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <HardDrive className="size-4 text-primary" />
                  Active Sessions
                </CardTitle>
                <CardDescription>
                  Manage active login sessions for your account across web browsers and devices.
                </CardDescription>
              </div>

              {otherSessionsCount > 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRevokeOtherSessions}
                  disabled={isPending}
                  className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20 gap-1.5"
                >
                  <LogOut className="size-3.5" />
                  Sign Out Other Sessions ({otherSessionsCount})
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="pt-4 divide-y">
              {profileData.activeSessions.map((session) => {
                const device = parseDevice(session.userAgent);
                return (
                  <div key={session.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                        {device.isMobile ? <Smartphone className="size-4" /> : <Laptop className="size-4" />}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold leading-tight text-foreground">
                            {device.name}
                          </p>
                          {session.isCurrent ? (
                            <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 bg-emerald-500/10 text-[10px] gap-1 px-1.5 py-0">
                              <span className="size-1 rounded-full bg-emerald-500" /> Current Session
                            </Badge>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                          {session.ipAddress ? <span>IP: {session.ipAddress}</span> : null}
                          <span>
                            Started: {new Date(session.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right text-xs text-muted-foreground hidden sm:block">
                      <span>Expires: {new Date(session.expiresAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* TAB 4: PREFERENCES                                            */}
        {/* ───────────────────────────────────────────────────────────── */}
        <TabsContent value="preferences" className="outline-none">
          <Card>
            <form onSubmit={handlePreferencesSubmit}>
              <CardHeader className="border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sliders className="size-4 text-primary" />
                  Personal Workspace Preferences
                </CardTitle>
                <CardDescription>
                  Configure display ergonomics, theme mode, and reporting defaults tailored to your workflow.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {/* Theme Selection */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Appearance Theme</Label>
                  <div className="grid grid-cols-3 gap-3 max-w-md">
                    <button
                      type="button"
                      onClick={() => setTheme('light')}
                      className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs gap-2 transition-all ${
                        theme === 'light'
                          ? 'border-primary ring-2 ring-primary/20 bg-primary/5 text-primary font-semibold'
                          : 'border-border hover:bg-muted text-muted-foreground'
                      }`}
                    >
                      <Sun className="size-5" />
                      <span>Light</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTheme('dark')}
                      className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs gap-2 transition-all ${
                        theme === 'dark'
                          ? 'border-primary ring-2 ring-primary/20 bg-primary/5 text-primary font-semibold'
                          : 'border-border hover:bg-muted text-muted-foreground'
                      }`}
                    >
                      <Moon className="size-5" />
                      <span>Dark</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTheme('system')}
                      className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs gap-2 transition-all ${
                        theme === 'system'
                          ? 'border-primary ring-2 ring-primary/20 bg-primary/5 text-primary font-semibold'
                          : 'border-border hover:bg-muted text-muted-foreground'
                      }`}
                    >
                      <Laptop className="size-5" />
                      <span>System Default</span>
                    </button>
                  </div>
                </div>

                <Separator />

                {/* Table Density */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Data Table Density</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Controls line-height and cell padding across inventory, reports, and sales ledgers.
                  </p>
                  <div className="grid grid-cols-2 gap-3 max-w-sm">
                    <button
                      type="button"
                      onClick={() => setTableDensity('comfortable')}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs transition-all ${
                        tableDensity === 'comfortable'
                          ? 'border-primary ring-2 ring-primary/20 bg-primary/5 text-primary font-semibold'
                          : 'border-border hover:bg-muted text-muted-foreground'
                      }`}
                    >
                      <span>Comfortable (Standard)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTableDensity('compact')}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs transition-all ${
                        tableDensity === 'compact'
                          ? 'border-primary ring-2 ring-primary/20 bg-primary/5 text-primary font-semibold'
                          : 'border-border hover:bg-muted text-muted-foreground'
                      }`}
                    >
                      <span>Compact (Dense)</span>
                    </button>
                  </div>
                </div>

                <Separator />

                {/* Default Date Range Filter */}
                <div className="space-y-2">
                  <Label htmlFor="dateRange" className="text-xs font-semibold">
                    Default Analytics Date Range
                  </Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Applied automatically when opening analytics, reports, and order logs.
                  </p>
                  <select
                    id="dateRange"
                    value={defaultDateRange}
                    onChange={(e) => setDefaultDateRange(e.target.value)}
                    className="flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                    <option value="90d">Last 90 Days</option>
                  </select>
                </div>

                {/* Preferred Branch Dropdown (for multi-branch roles) */}
                {allBranches.length > 1 ? (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <Label htmlFor="preferredBranch" className="text-xs font-semibold">
                        Default Active Branch View
                      </Label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Preferred branch to select automatically on multi-branch dashboards and filters.
                      </p>
                      <select
                        id="preferredBranch"
                        value={preferredBranchId || ''}
                        onChange={(e) => setPreferredBranchId(e.target.value || null)}
                        className="flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="">All Authorized Branches</option>
                        {allBranches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : null}
              </CardContent>
              <CardFooter className="border-t flex justify-end">
                <Button type="submit" size="sm" disabled={isPending} className="gap-2">
                  <Save className="size-4" />
                  {isPending ? 'Saving...' : 'Save Workspace Preferences'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
