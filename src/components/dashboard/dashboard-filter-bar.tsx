'use client';

import React, { useState } from 'react';
import {
  Calendar,
  Building2,
  RefreshCw,
  Download,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { DashboardDatePreset } from '@/lib/reports/dashboard-types';

interface DashboardFilterBarProps {
  preset: DashboardDatePreset;
  selectedBranchId: string;
  from?: string;
  to?: string;
  branches: Array<{ id: string; name: string; code: string }>;
  isBranchRestricted: boolean;
  isPending: boolean;
  onFilterChange: (filters: {
    preset: DashboardDatePreset;
    branchId: string;
    from?: string;
    to?: string;
  }) => void;
  onRefresh: () => void;
  onExportCSV: () => Promise<void>;
}

const PRESET_OPTIONS: Array<{ value: DashboardDatePreset; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: 'month', label: 'This Month' },
  { value: 'custom', label: 'Custom' },
];

export function DashboardFilterBar({
  preset,
  selectedBranchId,
  from,
  to,
  branches,
  isBranchRestricted,
  isPending,
  onFilterChange,
  onRefresh,
  onExportCSV,
}: DashboardFilterBarProps) {
  const [customFrom, setCustomFrom] = useState(from || '');
  const [customTo, setCustomTo] = useState(to || '');
  const [showCustomModal, setShowCustomModal] = useState(preset === 'custom');
  const [exporting, setExporting] = useState(false);

  const handlePresetSelect = (newPreset: DashboardDatePreset) => {
    if (newPreset === 'custom') {
      setShowCustomModal(true);
      return;
    }
    setShowCustomModal(false);
    onFilterChange({
      preset: newPreset,
      branchId: selectedBranchId,
    });
  };

  const handleCustomApply = () => {
    if (!customFrom || !customTo) return;
    if (customFrom > customTo) {
      alert('Start date must be before or equal to end date.');
      return;
    }
    onFilterChange({
      preset: 'custom',
      branchId: selectedBranchId,
      from: customFrom,
      to: customTo,
    });
  };

  const handleBranchSelect = (branchId: string) => {
    onFilterChange({
      preset,
      branchId,
      from: preset === 'custom' ? customFrom : undefined,
      to: preset === 'custom' ? customTo : undefined,
    });
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      await onExportCSV();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="bg-card/70 backdrop-blur border border-border/60 rounded-2xl p-4 shadow-sm space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Date Preset Segmented Control */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-muted/40 border border-border/40 rounded-xl">
          {PRESET_OPTIONS.map((opt) => {
            const isActive = preset === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handlePresetSelect(opt.value)}
                disabled={isPending}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Branch Filter & Utility Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Branch Selector */}
          {!isBranchRestricted && branches.length > 1 && (
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <select
                aria-label="Filter by branch"
                value={selectedBranchId}
                onChange={(e) => handleBranchSelect(e.target.value)}
                disabled={isPending}
                className="text-xs bg-background border border-border/70 rounded-xl px-3 py-1.5 font-medium focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
              >
                <option value="all">All Accessible Branches ({branches.length})</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {isBranchRestricted && branches.length === 1 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/40 border border-border/40 rounded-xl text-xs font-medium">
              <Building2 className="w-3.5 h-3.5 text-primary" />
              <span>{branches[0].name}</span>
              <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono">
                {branches[0].code}
              </Badge>
            </div>
          )}

          {/* Refresh Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isPending}
            className="h-8 gap-1.5 text-xs rounded-xl"
            aria-label="Refresh dashboard data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin text-primary' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          {/* Export CSV Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isPending || exporting}
            className="h-8 gap-1.5 text-xs rounded-xl hover:text-primary"
            aria-label="Export dashboard summary CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {exporting ? 'Exporting...' : 'Export CSV'}
            </span>
          </Button>
        </div>
      </div>

      {/* Custom Date Range Picker (shown when preset is 'custom' or showCustomModal is true) */}
      {(preset === 'custom' || showCustomModal) && (
        <div className="pt-3 border-t border-border/40 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-foreground">Custom Range:</span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="custom-from" className="text-muted-foreground">From:</label>
            <input
              id="custom-from"
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="bg-background border border-border rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="custom-to" className="text-muted-foreground">To:</label>
            <input
              id="custom-to"
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="bg-background border border-border rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>

          <Button
            type="button"
            size="sm"
            onClick={handleCustomApply}
            disabled={isPending || !customFrom || !customTo}
            className="h-7 px-3 text-xs rounded-lg gap-1"
          >
            <Check className="w-3.5 h-3.5" />
            Apply Dates
          </Button>
        </div>
      )}
    </div>
  );
}
