'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Package,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  History,
  Search,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ReportViewContainer, type SummaryCardItem } from './report-view-container';
import { formatNumber } from '@/lib/reports/constants';
import type {
  InventoryReportRow,
  StockMovementReportRow,
  InventoryReportSummary,
  PaginationMeta,
  DateRangePreset,
} from '@/lib/reports/types';
import { exportInventoryReportCSVAction, exportStockMovementsReportCSVAction } from '@/lib/reports/actions';

interface InventoryReportClientProps {
  currentStockRows: InventoryReportRow[];
  movementRows: StockMovementReportRow[];
  summary: InventoryReportSummary;
  pagination: PaginationMeta;
  movementsPagination: PaginationMeta;
  branches: Array<{ id: string; name: string; code: string }>;
  selectedBranchId: string;
  isBranchRestricted: boolean;
  selectedPreset: string;
  startDate?: string;
  endDate?: string;
  currentStatus?: string;
  currentSearch?: string;
  activeTab?: string;
}

export function InventoryReportClient({
  currentStockRows,
  movementRows,
  summary,
  pagination,
  movementsPagination,
  branches,
  selectedBranchId,
  isBranchRestricted,
  selectedPreset,
  startDate,
  endDate,
  currentStatus = 'all',
  currentSearch = '',
  activeTab = 'stock',
}: InventoryReportClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState(activeTab);
  const [searchInput, setSearchInput] = useState(currentSearch);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(newPage));
    router.push(`?${params.toString()}`);
  };

  const handleTabChange = (newTab: string) => {
    setTab(newTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', newTab);
    params.delete('page');
    router.push(`?${params.toString()}`);
  };

  const handleStatusChange = (status: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!status || status === 'all') params.delete('status');
    else params.set('status', status);
    params.delete('page');
    router.push(`?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (!searchInput) params.delete('search');
    else params.set('search', searchInput);
    params.delete('page');
    router.push(`?${params.toString()}`);
  };

  const handleExport = async () => {
    if (tab === 'movements') {
      const res = await exportStockMovementsReportCSVAction({
        branchId: selectedBranchId,
        preset: selectedPreset as DateRangePreset,
        startDate,
        endDate,
        search: currentSearch,
      });
      return res.success && res.csv ? { csv: res.csv, filename: res.filename } : null;
    } else {
      const res = await exportInventoryReportCSVAction({
        branchId: selectedBranchId,
        status: currentStatus,
        search: currentSearch,
      });
      return res.success && res.csv ? { csv: res.csv, filename: res.filename } : null;
    }
  };

  const summaryCards: SummaryCardItem[] = [
    {
      label: 'Ingredients Tracked',
      value: formatNumber(summary.totalIngredients),
      icon: Package,
    },
    {
      label: 'Optimal Stock',
      value: formatNumber(summary.inStockCount),
      icon: CheckCircle2,
    },
    {
      label: 'Low Stock Items',
      value: formatNumber(summary.lowStockCount),
      icon: AlertTriangle,
    },
    {
      label: 'Out of Stock Items',
      value: formatNumber(summary.outOfStockCount),
      icon: XCircle,
    },
    {
      label: 'Ledger Movements',
      value: formatNumber(summary.totalMovementsCount),
      icon: History,
    },
  ];

  const extraFilters = (
    <>
      <form onSubmit={handleSearchSubmit} className="relative w-44">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Ingredient..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="h-9 pl-8 text-xs"
        />
      </form>

      {tab === 'stock' && (
        <div className="w-32">
          <Select value={currentStatus} onValueChange={handleStatusChange}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Health" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Health</SelectItem>
              <SelectItem value="IN_STOCK">Optimal</SelectItem>
              <SelectItem value="LOW_STOCK">Low Stock</SelectItem>
              <SelectItem value="OUT_OF_STOCK">Out of Stock</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  );

  return (
    <ReportViewContainer
      title="Inventory & Stock Report"
      description="Real-time ingredient stock levels derived directly from immutable ledger transactions and historical movements."
      icon={Package}
      branches={branches}
      selectedBranchId={selectedBranchId}
      isBranchRestricted={isBranchRestricted}
      selectedPreset={selectedPreset}
      startDate={startDate}
      endDate={endDate}
      summaryCards={summaryCards}
      pagination={tab === 'stock' ? pagination : movementsPagination}
      onPageChange={handlePageChange}
      onExportCSV={handleExport}
      csvFilename={`inventory-${tab}-${selectedPreset}-${new Date().toISOString().split('T')[0]}.csv`}
      extraFilters={extraFilters}
    >
      <Tabs value={tab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="print:hidden">
          <TabsTrigger value="stock" className="text-xs gap-1.5">
            <Package className="h-3.5 w-3.5" />
            Current Stock Balances
          </TabsTrigger>
          <TabsTrigger value="movements" className="text-xs gap-1.5">
            <History className="h-3.5 w-3.5" />
            Stock Ledger Movements
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="m-0">
          <Card className="border border-border/60 shadow-xs overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="font-semibold">Ingredient</TableHead>
                      <TableHead className="font-semibold">Branch</TableHead>
                      <TableHead className="font-semibold">Category</TableHead>
                      <TableHead className="font-semibold">Unit</TableHead>
                      <TableHead className="text-right font-semibold">Current Stock</TableHead>
                      <TableHead className="text-right font-semibold">Min Stock</TableHead>
                      <TableHead className="text-right font-semibold">Reorder Level</TableHead>
                      <TableHead className="font-semibold">Health Status</TableHead>
                      <TableHead className="font-semibold">Last Movement</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentStockRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12 text-muted-foreground text-sm">
                          No inventory records found for the selected branch.
                        </TableCell>
                      </TableRow>
                    ) : (
                      currentStockRows.map((r) => (
                        <TableRow key={r.id} className="hover:bg-muted/20">
                          <TableCell className="font-semibold text-xs text-foreground">
                            {r.ingredientName}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.branchName}
                          </TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className="text-[10px]">
                              {r.categoryName}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-mono uppercase text-muted-foreground">
                            {r.unit}
                          </TableCell>
                          <TableCell className={`text-right text-xs font-bold font-mono ${
                            r.status === 'OUT_OF_STOCK'
                              ? 'text-red-600 dark:text-red-400'
                              : r.status === 'LOW_STOCK'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-foreground'
                          }`}>
                            {formatNumber(r.currentStock)}
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono text-muted-foreground">
                            {formatNumber(r.minStock)}
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono text-muted-foreground">
                            {formatNumber(r.reorderLevel)}
                          </TableCell>
                          <TableCell className="text-xs">
                            <Badge
                              variant={r.status === 'OUT_OF_STOCK' ? 'destructive' : r.status === 'LOW_STOCK' ? 'secondary' : 'default'}
                              className="text-[10px]"
                            >
                              {r.status === 'OUT_OF_STOCK' ? 'Out of Stock' : r.status === 'LOW_STOCK' ? 'Low Stock' : 'Optimal'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">
                            {r.lastMovementDate || '—'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements" className="m-0">
          <Card className="border border-border/60 shadow-xs overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="font-semibold">Date</TableHead>
                      <TableHead className="font-semibold">Branch</TableHead>
                      <TableHead className="font-semibold">Ingredient</TableHead>
                      <TableHead className="font-semibold">Transaction Type</TableHead>
                      <TableHead className="text-right font-semibold">Quantity</TableHead>
                      <TableHead className="font-semibold">Unit</TableHead>
                      <TableHead className="font-semibold">Reference #</TableHead>
                      <TableHead className="font-semibold">Notes</TableHead>
                      <TableHead className="font-semibold">Logged By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movementRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12 text-muted-foreground text-sm">
                          No stock movements recorded for the selected period.
                        </TableCell>
                      </TableRow>
                    ) : (
                      movementRows.map((m) => (
                        <TableRow key={m.id} className="hover:bg-muted/20">
                          <TableCell className="text-xs font-medium text-foreground whitespace-nowrap">
                            {m.date}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {m.branchName}
                          </TableCell>
                          <TableCell className="font-medium text-xs text-foreground">
                            {m.ingredientName}
                          </TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className="text-[10px] font-mono">
                              {m.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono font-bold">
                            {formatNumber(m.quantity)}
                          </TableCell>
                          <TableCell className="text-xs font-mono uppercase text-muted-foreground">
                            {m.unit}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {m.referenceId || '—'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                            {m.notes || '—'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {m.createdBy}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </ReportViewContainer>
  );
}
