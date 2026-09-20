'use client';

import React, { useState } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { DateRangePreset, ReportDateRange } from '@/lib/reports/types';
import { getDateRangeFromPreset } from '@/lib/reports/constants';

interface DateRangePickerProps {
  value?: ReportDateRange;
  preset?: DateRangePreset;
  onChange: (range: ReportDateRange, preset: DateRangePreset) => void;
  className?: string;
}

const PRESET_OPTIONS: { label: string; preset: DateRangePreset }[] = [
  { label: 'Today', preset: 'today' },
  { label: 'Yesterday', preset: 'yesterday' },
  { label: 'This Week', preset: 'week' },
  { label: 'This Month', preset: 'month' },
];

export function DateRangePicker({
  value,
  preset = 'today',
  onChange,
  className = '',
}: DateRangePickerProps) {
  const [currentPreset, setCurrentPreset] = useState<DateRangePreset>(preset);
  const [customStart, setCustomStart] = useState<string>(
    value?.startDate || getDateRangeFromPreset('today').startDate
  );
  const [customEnd, setCustomEnd] = useState<string>(
    value?.endDate || getDateRangeFromPreset('today').endDate
  );
  const [isCustomOpen, setIsCustomOpen] = useState(preset === 'custom');

  const handlePresetSelect = (selected: DateRangePreset) => {
    setCurrentPreset(selected);
    setIsCustomOpen(false);
    const newRange = getDateRangeFromPreset(selected);
    setCustomStart(newRange.startDate);
    setCustomEnd(newRange.endDate);
    onChange(newRange, selected);
  };

  const handleCustomApply = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customStart || !customEnd) return;
    setCurrentPreset('custom');
    onChange({ startDate: customStart, endDate: customEnd }, 'custom');
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-2 bg-card/60 backdrop-blur-sm border border-border/60 p-1.5 rounded-xl shadow-xs ${className}`}
    >
      <div className="flex items-center gap-1">
        {PRESET_OPTIONS.map((opt) => {
          const isActive = currentPreset === opt.preset && !isCustomOpen;
          return (
            <Button
              key={opt.preset}
              type="button"
              variant={isActive ? 'default' : 'ghost'}
              size="sm"
              className={`h-8 px-3 text-xs font-medium rounded-lg transition-all ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => handlePresetSelect(opt.preset)}
            >
              {opt.label}
            </Button>
          );
        })}

        <Button
          type="button"
          variant={currentPreset === 'custom' || isCustomOpen ? 'default' : 'ghost'}
          size="sm"
          className={`h-8 px-3 text-xs font-medium rounded-lg transition-all ${
            currentPreset === 'custom' || isCustomOpen
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setIsCustomOpen(!isCustomOpen)}
        >
          <CalendarIcon className="w-3.5 h-3.5 mr-1" />
          Custom
        </Button>
      </div>

      {isCustomOpen && (
        <form
          onSubmit={handleCustomApply}
          className="flex items-center gap-2 pl-2 border-t md:border-t-0 md:border-l border-border/60 pt-2 md:pt-0"
        >
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Input
              type="date"
              value={customStart}
              max={customEnd}
              onChange={(e) => setCustomStart(e.target.value)}
              className="h-8 text-xs w-32 bg-background/80"
              required
            />
            <span>to</span>
            <Input
              type="date"
              value={customEnd}
              min={customStart}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="h-8 text-xs w-32 bg-background/80"
              required
            />
          </div>
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            className="h-8 px-3 text-xs font-medium"
          >
            Apply
          </Button>
        </form>
      )}
    </div>
  );
}
