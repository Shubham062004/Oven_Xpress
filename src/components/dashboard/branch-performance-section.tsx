'use client';

import React, { useState } from 'react';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, ArrowUpDown } from 'lucide-react';
import type { BranchPerformanceItem } from '@/lib/reports/dashboard-types';
import { formatCurrency, formatNumber } from '@/lib/reports/constants';

interface BranchPerformanceSectionProps {
  branches: BranchPerformanceItem[];
  canViewFinancials: boolean;
  isPending?: boolean;
}

type SortField = 'branchName' | 'orderCount' | 'netSales' | 'operatingResult';

export function BranchPerformanceSection({
  branches,
  canViewFinancials,
  isPending,
}: BranchPerformanceSectionProps) {
  const [sortField, setSortField] = useState<SortField>('branchName');
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false); // default descending for metrics
    }
  };

  const sortedBranches = [...branches].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'branchName') {
      comparison = a.branchName.localeCompare(b.branchName);
    } else {
      comparison = (a[sortField] || 0) - (b[sortField] || 0);
    }
    return sortAsc ? comparison : -comparison;
  });

  return (
    <Card className="border border-border/60 shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            <CardTitle className="text-base font-semibold text-foreground">
              Branch Operational Performance
            </CardTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Factual side-by-side operational metrics across authorized locations.
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {branches.length} {branches.length === 1 ? 'Branch' : 'Branches'}
        </Badge>
      </CardHeader>

      <CardContent>
        {branches.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No branch performance records found for this period.
          </div>
        ) : (
          <div className={`overflow-x-auto ${isPending ? 'opacity-50' : ''}`}>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead
                    className="cursor-pointer font-semibold text-xs"
                    onClick={() => handleSort('branchName')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Branch</span>
                      <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer font-semibold text-xs"
                    onClick={() => handleSort('orderCount')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Orders</span>
                      <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                    </div>
                  </TableHead>
                  {canViewFinancials && (
                    <>
                      <TableHead
                        className="text-right cursor-pointer font-semibold text-xs"
                        onClick={() => handleSort('netSales')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Net Sales</span>
                          <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                        </div>
                      </TableHead>
                      <TableHead className="text-right font-semibold text-xs">
                        Avg Order Value
                      </TableHead>
                      <TableHead className="text-right font-semibold text-xs">
                        Payments Settled
                      </TableHead>
                      <TableHead className="text-right font-semibold text-xs">
                        Expenses
                      </TableHead>
                      <TableHead
                        className="text-right cursor-pointer font-semibold text-xs"
                        onClick={() => handleSort('operatingResult')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Operating Result</span>
                          <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                        </div>
                      </TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>

              <TableBody>
                {sortedBranches.map((b) => (
                  <TableRow key={b.branchId} className="text-xs hover:bg-muted/40 transition-colors">
                    <TableCell className="font-medium py-3">
                      <div className="flex items-center gap-2">
                        <span>{b.branchName}</span>
                        <Badge variant="outline" className="text-[10px] font-mono py-0 px-1">
                          {b.branchCode}
                        </Badge>
                      </div>
                    </TableCell>

                    <TableCell className="text-right font-semibold">
                      {formatNumber(b.orderCount)}
                    </TableCell>

                    {canViewFinancials && (
                      <>
                        <TableCell className="text-right font-semibold text-primary">
                          {formatCurrency(b.netSales)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(b.averageOrderValue)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(b.successfulPayments)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(b.approvedExpenses)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-bold ${
                            b.operatingResult >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'
                          }`}
                        >
                          {formatCurrency(b.operatingResult)}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
