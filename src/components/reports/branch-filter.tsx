'use client';

import React from 'react';
import { Store, Lock } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface BranchFilterProps {
  branches: Array<{ id: string; name: string; code: string }>;
  value?: string;
  onChange: (branchId: string) => void;
  isRestricted?: boolean;
  className?: string;
}

export function BranchFilter({
  branches,
  value = 'all',
  onChange,
  isRestricted = false,
  className = '',
}: BranchFilterProps) {
  // If the user has a single branch or is restricted to their branch
  if (isRestricted || branches.length <= 1) {
    const branch = branches[0];
    return (
      <div
        className={`flex items-center gap-2 px-3 py-1.5 bg-card/60 border border-border/60 rounded-xl text-xs font-medium text-foreground ${className}`}
      >
        <Store className="w-3.5 h-3.5 text-primary" />
        <span>{branch ? `${branch.name} (${branch.code})` : 'Assigned Branch'}</span>
        <Badge variant="outline" className="text-[10px] h-5 px-1.5 gap-1 bg-muted/50">
          <Lock className="w-2.5 h-2.5" /> Scoped
        </Badge>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Select value={value} onValueChange={(val) => onChange(val ?? 'all')}>
        <SelectTrigger className="h-9 min-w-45 bg-card/60 border-border/60 text-xs rounded-xl">
          <div className="flex items-center gap-2 truncate">
            <Store className="w-3.5 h-3.5 text-primary shrink-0" />
            <SelectValue placeholder="Select branch" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="text-xs">
            🏢 All Branches
          </SelectItem>
          {branches.map((b) => (
            <SelectItem key={b.id} value={b.id} className="text-xs">
              {b.name} ({b.code})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
