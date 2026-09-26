'use client';

import React, { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Building2,
  Store,
  ShoppingBag,
  Boxes,
  Bell,
  CreditCard,
  Receipt,
  Clock,
  Palette,
  Search,
  History,
  Save,
  RotateCcw,
  Check,
  AlertTriangle,
  Sliders,
  Sparkles,
  Lock,
  User as UserIcon,
} from 'lucide-react';
import {
  SETTING_CATEGORIES,
  SettingCategory,
} from '@/lib/settings/setting-definitions';
import { ResolvedSettingItem } from '@/lib/settings/settings-service';
import {
  updateSettingAction,
  resetSettingAction,
  updateUserPreferencesAction,
} from '@/lib/settings/actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface SettingsClientProps {
  initialSettings: ResolvedSettingItem[];
  authorizedBranches: { id: string; name: string }[];
  isAllBranches: boolean;
  userRole: string;
  userPermissions: string[];
  initialBranchId: string | null;
  userPreferences: {
    theme: string;
    tableDensity: string;
    defaultDateRange: string;
    preferredBranchId: string | null;
  };
}

const CATEGORY_ICONS: Record<SettingCategory, React.ReactNode> = {
  BUSINESS: <Building2 className="size-4" />,
  BRANCH: <Store className="size-4" />,
  ORDERS: <ShoppingBag className="size-4" />,
  INVENTORY: <Boxes className="size-4" />,
  NOTIFICATIONS: <Bell className="size-4" />,
  PAYMENTS: <CreditCard className="size-4" />,
  EXPENSES: <Receipt className="size-4" />,
  ATTENDANCE: <Clock className="size-4" />,
};

export function SettingsClient({
  initialSettings,
  authorizedBranches,
  isAllBranches,
  userRole,
  userPermissions,
  initialBranchId,
  userPreferences: initialPrefs,
}: SettingsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeCategory, setActiveCategory] = useState<SettingCategory | 'PREFERENCES'>('BUSINESS');
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(initialBranchId);
  const [searchQuery, setSearchQuery] = useState('');

  // Local form state for settings
  const [formValues, setFormValues] = useState<Record<string, unknown>>(() => {
    const map: Record<string, unknown> = {};
    for (const s of initialSettings) {
      map[s.key] = s.effectiveValue;
    }
    return map;
  });

  // Local user preferences state
  const [userPrefs, setUserPrefs] = useState(initialPrefs);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

  // Reset confirmation dialog state
  const [resetTarget, setResetTarget] = useState<ResolvedSettingItem | null>(null);

  // Check if current user has update permission
  const canUpdate = userPermissions.includes('settings.update') || userRole === 'OWNER' || userRole === 'ADMIN';

  // Handle branch change: navigates and reloads settings for that branch
  const handleBranchChange = (branchId: string | 'GLOBAL') => {
    const newBranchId = branchId === 'GLOBAL' ? null : branchId;
    setSelectedBranchId(newBranchId);
    startTransition(() => {
      const query = newBranchId ? `?branchId=${newBranchId}` : '';
      router.push(`/settings${query}`);
    });
  };

  // Filter settings based on active category and search query
  const filteredSettings = useMemo(() => {
    if (activeCategory === 'PREFERENCES') return [];

    return initialSettings.filter((s) => {
      const matchCat = s.category === activeCategory;
      if (!matchCat) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.key.toLowerCase().includes(q)
      );
    });
  }, [initialSettings, activeCategory, searchQuery]);

  // Handle single setting save
  const handleSaveSetting = async (setting: ResolvedSettingItem) => {
    const value = formValues[setting.key];
    const targetScope = selectedBranchId && setting.allowedScopes.includes('BRANCH') ? 'BRANCH' : 'GLOBAL';

    startTransition(async () => {
      try {
        const res = await updateSettingAction({
          key: setting.key,
          value,
          scope: targetScope,
          branchId: targetScope === 'BRANCH' ? selectedBranchId : null,
        });

        if (res.success) {
          toast.success(`Updated "${setting.name}" successfully`);
          router.refresh();
        } else {
          toast.error(res.error || `Failed to update ${setting.name}`);
        }
      } catch {
        toast.error('An unexpected error occurred while saving setting.');
      }
    });
  };

  // Handle reset confirmation
  const handleConfirmReset = async () => {
    if (!resetTarget) return;

    const setting = resetTarget;
    const targetScope = selectedBranchId && setting.isOverridden ? 'BRANCH' : 'GLOBAL';

    startTransition(async () => {
      try {
        const res = await resetSettingAction({
          key: setting.key,
          scope: targetScope,
          branchId: targetScope === 'BRANCH' ? selectedBranchId : null,
        });

        if (res.success) {
          toast.success(`Reset "${setting.name}" to default`);
          setResetTarget(null);
          router.refresh();
        } else {
          toast.error(res.error || `Failed to reset ${setting.name}`);
        }
      } catch {
        toast.error('An unexpected error occurred while resetting setting.');
      }
    });
  };

  // Save personal preferences
  const handleSavePreferences = async () => {
    setIsSavingPrefs(true);
    try {
      const res = await updateUserPreferencesAction({
        theme: userPrefs.theme as 'light' | 'dark' | 'system',
        tableDensity: userPrefs.tableDensity as 'compact' | 'comfortable',
        defaultDateRange: userPrefs.defaultDateRange as 'today' | 'yesterday' | '7d' | '30d' | '90d',
        preferredBranchId: userPrefs.preferredBranchId,
      });

      if (res.success) {
        toast.success('UI preferences saved successfully');
      } else {
        toast.error(res.error || 'Failed to update preferences');
      }
    } catch {
      toast.error('An error occurred while saving preferences.');
    } finally {
      setIsSavingPrefs(false);
    }
  };

  const currentBranchName = authorizedBranches.find((b) => b.id === selectedBranchId)?.name;

  return (
    <div className="space-y-6">
      {/* Top Header & Context Control */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sliders className="size-6 text-primary" />
            Settings & System Configuration
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure centralized business rules, operational thresholds, and branch behaviors.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Branch Scope Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Scope:</span>
            <select
              aria-label="Configuration Scope"
              value={selectedBranchId || 'GLOBAL'}
              onChange={(e) => handleBranchChange(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-3 py-1 text-sm font-medium shadow-xs focus:border-ring focus:outline-hidden"
              disabled={isPending}
            >
              {isAllBranches && <option value="GLOBAL">🌐 Global System Settings</option>}
              {authorizedBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  🏢 Branch: {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Audit Trail Shortcut */}
          <Link
            href="/audit-logs?entityType=SYSTEM_SETTING"
            className={buttonVariants({ variant: 'outline', size: 'sm', className: 'gap-1.5 h-9' })}
          >
            <History className="size-3.5" />
            <span>Audit Trail</span>
          </Link>
        </div>
      </div>

      {/* Scope Info Banner */}
      <div className="rounded-lg border border-border/80 bg-muted/40 p-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Badge variant={selectedBranchId ? 'secondary' : 'default'} className="uppercase font-semibold text-xs">
            {selectedBranchId ? 'Branch Scope' : 'Global Scope'}
          </Badge>
          <span className="text-sm font-medium text-foreground">
            {selectedBranchId
              ? `Configuring overrides for "${currentBranchName}". Unset values seamlessly inherit global defaults.`
              : 'Configuring central organization-wide settings applicable across all branches.'}
          </span>
        </div>
        {selectedBranchId && (
          <span className="text-xs text-muted-foreground hidden md:inline">
            Hierarchical 3-tier resolution active
          </span>
        )}
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Category Navigation Sidebar */}
        <div className="md:col-span-4 lg:col-span-3 space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2">
            Configuration Areas
          </div>
          {SETTING_CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            const count = initialSettings.filter((s) => s.category === cat.id).length;
            const overrideCount = initialSettings.filter(
              (s) => s.category === cat.id && s.isOverridden
            ).length;

            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  {CATEGORY_ICONS[cat.id]}
                  <span className="truncate">{cat.label}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {overrideCount > 0 && selectedBranchId && (
                    <span className={`text-xs px-1.5 py-0.2 rounded-full font-bold ${isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'}`}>
                      {overrideCount}
                    </span>
                  )}
                  <span className={`text-xs ${isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                    {count}
                  </span>
                </div>
              </button>
            );
          })}

          <div className="pt-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2">
              User Personalization
            </div>
            <button
              onClick={() => setActiveCategory('PREFERENCES')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left ${
                activeCategory === 'PREFERENCES'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Palette className="size-4" />
                <span>My Preferences</span>
              </div>
              <Sparkles className="size-3.5 opacity-70" />
            </button>
          </div>

          <div className="pt-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2">
              User Account
            </div>
            <Link
              href="/profile"
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left text-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <div className="flex items-center gap-2.5">
                <UserIcon className="size-4" />
                <span>My Profile & Account</span>
              </div>
            </Link>
            <Link
              href="/profile/password"
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left text-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <div className="flex items-center gap-2.5">
                <Lock className="size-4" />
                <span>Change Password</span>
              </div>
            </Link>
          </div>
        </div>

        {/* Content Pane */}
        <div className="md:col-span-8 lg:col-span-9 space-y-4">
          {activeCategory === 'PREFERENCES' ? (
            /* User Preferences Section */
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Palette className="size-5 text-primary" />
                  <CardTitle>Personal UI Preferences</CardTitle>
                </div>
                <CardDescription>
                  Configure your personal interface options, display density, and default date ranges. These settings apply only to your user account.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Theme Preference */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Color Theme</label>
                  <p className="text-xs text-muted-foreground">Select how the interface appears on your device.</p>
                  <div className="grid grid-cols-3 gap-3 pt-1 max-w-md">
                    {(['system', 'light', 'dark'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setUserPrefs((prev) => ({ ...prev, theme: mode }))}
                        className={`px-3 py-2 rounded-md border text-sm font-medium capitalize transition-all ${
                          userPrefs.theme === mode
                            ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
                            : 'border-border bg-background hover:bg-muted text-muted-foreground'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Table Density */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Table Row Density</label>
                  <p className="text-xs text-muted-foreground">Control row padding across data grids and report tables.</p>
                  <div className="grid grid-cols-2 gap-3 pt-1 max-w-xs">
                    {(['comfortable', 'compact'] as const).map((density) => (
                      <button
                        key={density}
                        type="button"
                        onClick={() => setUserPrefs((prev) => ({ ...prev, tableDensity: density }))}
                        className={`px-3 py-2 rounded-md border text-sm font-medium capitalize transition-all ${
                          userPrefs.tableDensity === density
                            ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
                            : 'border-border bg-background hover:bg-muted text-muted-foreground'
                        }`}
                      >
                        {density}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Default Date Range */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Default Dashboard Date Range</label>
                  <p className="text-xs text-muted-foreground">Pre-selected timeframe for analytical metrics and reports.</p>
                  <select
                    aria-label="Default Date Range"
                    value={userPrefs.defaultDateRange}
                    onChange={(e) => setUserPrefs((prev) => ({ ...prev, defaultDateRange: e.target.value }))}
                    className="h-9 max-w-xs rounded-md border border-border bg-background px-3 py-1 text-sm font-medium shadow-xs"
                  >
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                    <option value="90d">Last 90 Days</option>
                  </select>
                </div>

                {/* Preferred Branch */}
                {authorizedBranches.length > 1 && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Preferred Default Branch</label>
                    <p className="text-xs text-muted-foreground">Pre-selects this branch when visiting branch-aware screens.</p>
                    <select
                      aria-label="Preferred Default Branch"
                      value={userPrefs.preferredBranchId || ''}
                      onChange={(e) => setUserPrefs((prev) => ({ ...prev, preferredBranchId: e.target.value || null }))}
                      className="h-9 max-w-sm rounded-md border border-border bg-background px-3 py-1 text-sm font-medium shadow-xs"
                    >
                      <option value="">No preference (All branches)</option>
                      {authorizedBranches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="pt-2">
                  <Button
                    onClick={handleSavePreferences}
                    disabled={isSavingPrefs}
                    className="gap-2"
                  >
                    <Save className="size-4" />
                    <span>{isSavingPrefs ? 'Saving Preferences...' : 'Save Preferences'}</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* System & Operational Settings Category */
            <div className="space-y-4">
              {/* Category Search & Filter */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder={`Filter ${activeCategory.toLowerCase()} settings...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-sm"
                  />
                </div>
                <div className="text-xs text-muted-foreground shrink-0 self-center">
                  Showing {filteredSettings.length} setting{filteredSettings.length === 1 ? '' : 's'}
                </div>
              </div>

              {/* Setting List Cards */}
              <div className="space-y-3">
                {filteredSettings.length === 0 ? (
                  <Card className="border-dashed py-8 text-center">
                    <div className="text-sm text-muted-foreground">
                      No settings match your search criteria in this category.
                    </div>
                  </Card>
                ) : (
                  filteredSettings.map((setting) => {
                    const isDirty = formValues[setting.key] !== setting.effectiveValue;
                    const canEditThisSetting =
                      canUpdate &&
                      (selectedBranchId ? setting.allowedScopes.includes('BRANCH') : setting.allowedScopes.includes('GLOBAL'));

                    return (
                      <Card
                        key={setting.key}
                        className={`transition-all ${
                          isDirty ? 'border-primary/50 shadow-xs ring-1 ring-primary/20' : 'border-border/80'
                        }`}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground text-sm">
                                  {setting.name}
                                </span>
                                <code className="text-[11px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                  {setting.key}
                                </code>
                              </div>
                              <CardDescription className="text-xs">
                                {setting.description}
                              </CardDescription>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {setting.scope === 'BRANCH' ? (
                                <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-medium text-xs">
                                  Branch Override
                                </Badge>
                              ) : setting.scope === 'GLOBAL' ? (
                                <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-medium text-xs">
                                  Global Config
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground font-medium text-xs">
                                  Application Default
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="space-y-3 pt-0">
                          {/* Input field based on dataType */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                            <div className="flex-1 max-w-lg">
                              {setting.dataType === 'BOOLEAN' ? (
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={!canEditThisSetting || isPending}
                                    onClick={() =>
                                      setFormValues((prev) => ({
                                        ...prev,
                                        [setting.key]: !prev[setting.key],
                                      }))
                                    }
                                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50 ${
                                      formValues[setting.key] ? 'bg-primary' : 'bg-muted'
                                    }`}
                                  >
                                    <span
                                      className={`pointer-events-none inline-block size-5 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out ${
                                        formValues[setting.key] ? 'translate-x-5' : 'translate-x-0'
                                      }`}
                                    />
                                  </button>
                                  <span className="text-sm font-medium text-foreground">
                                    {formValues[setting.key] ? 'Enabled' : 'Disabled'}
                                  </span>
                                </div>
                              ) : setting.options ? (
                                <select
                                  aria-label={setting.name}
                                  value={String(formValues[setting.key] ?? '')}
                                  disabled={!canEditThisSetting || isPending}
                                  onChange={(e) =>
                                    setFormValues((prev) => ({
                                      ...prev,
                                      [setting.key]: e.target.value,
                                    }))
                                  }
                                  className="h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm shadow-xs focus:border-ring focus:outline-hidden disabled:opacity-50"
                                >
                                  {setting.options.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              ) : setting.dataType === 'NUMBER' ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    value={String(formValues[setting.key] ?? '')}
                                    disabled={!canEditThisSetting || isPending}
                                    min={setting.min}
                                    max={setting.max}
                                    onChange={(e) =>
                                      setFormValues((prev) => ({
                                        ...prev,
                                        [setting.key]: Number(e.target.value),
                                      }))
                                    }
                                    className="h-9 w-36 font-mono text-sm"
                                  />
                                  {setting.min !== undefined && setting.max !== undefined && (
                                    <span className="text-xs text-muted-foreground">
                                      (Min: {setting.min}, Max: {setting.max})
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <Input
                                  type="text"
                                  value={String(formValues[setting.key] ?? '')}
                                  disabled={!canEditThisSetting || isPending}
                                  onChange={(e) =>
                                    setFormValues((prev) => ({
                                      ...prev,
                                      [setting.key]: e.target.value,
                                    }))
                                  }
                                  className="h-9 font-medium text-sm"
                                />
                              )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                              {/* Reset Button */}
                              {(setting.isOverridden || (setting.scope === 'GLOBAL' && setting.globalValue !== null)) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={!canEditThisSetting || isPending}
                                  onClick={() => setResetTarget(setting)}
                                  className="gap-1 h-8 text-xs text-muted-foreground hover:text-destructive"
                                >
                                  <RotateCcw className="size-3" />
                                  <span>{setting.isOverridden ? 'Remove Override' : 'Reset'}</span>
                                </Button>
                              )}

                              {/* Save Changes Button */}
                              <Button
                                size="sm"
                                disabled={!isDirty || !canEditThisSetting || isPending}
                                onClick={() => handleSaveSetting(setting)}
                                className="gap-1.5 h-8 text-xs"
                              >
                                <Check className="size-3.5" />
                                <span>Save</span>
                              </Button>
                            </div>
                          </div>

                          {/* Dirty notification indicator */}
                          {isDirty && (
                            <div className="text-[11px] text-primary font-medium flex items-center gap-1 pt-1">
                              <span className="inline-block size-1.5 rounded-full bg-primary animate-pulse" />
                              Unsaved modifications. Click Save to persist.
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reset Confirmation Dialog */}
      <Dialog open={!!resetTarget} onOpenChange={(open) => !open && setResetTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              <DialogTitle>Reset Setting Configuration</DialogTitle>
            </div>
            <DialogDescription className="pt-2 text-sm">
              Are you sure you want to reset{' '}
              <strong className="text-foreground">{resetTarget?.name}</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-border/80 bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
            {resetTarget?.isOverridden ? (
              <p>
                This will delete the branch override for{' '}
                <span className="font-semibold text-foreground">{currentBranchName}</span>. The value will immediately fall back to the global setting or system default.
              </p>
            ) : (
              <p>
                This will clear the database entry and restore the application default value:{' '}
                <code className="font-mono text-foreground font-semibold">
                  {String(resetTarget?.defaultValue)}
                </code>.
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setResetTarget(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmReset}
              disabled={isPending}
            >
              {isPending ? 'Resetting...' : 'Confirm Reset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
