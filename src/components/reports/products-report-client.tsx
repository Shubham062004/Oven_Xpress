'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  UtensilsCrossed,
  Package,
  IndianRupee,
  Percent,
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
import { ReportViewContainer, type SummaryCardItem } from './report-view-container';
import { formatCurrency, formatNumber } from '@/lib/reports/constants';
import type { ProductsReportRow, ProductsReportSummary, PaginationMeta, DateRangePreset } from '@/lib/reports/types';
import { exportProductSalesReportCSVAction } from '@/lib/reports/actions';

interface ProductsReportClientProps {
  rows: ProductsReportRow[];
  summary: ProductsReportSummary;
  pagination: PaginationMeta;
  branches: Array<{ id: string; name: string; code: string }>;
  categories: Array<{ id: string; name: string }>;
  selectedBranchId: string;
  isBranchRestricted: boolean;
  selectedPreset: string;
  startDate?: string;
  endDate?: string;
}

export function ProductsReportClient({
  rows,
  summary,
  pagination,
  branches,
  categories,
  selectedBranchId,
  isBranchRestricted,
  selectedPreset,
  startDate,
  endDate,
}: ProductsReportClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentCategory = searchParams.get('categoryId') || 'all';
  const currentSearch = searchParams.get('search') || '';
  const [searchInput, setSearchInput] = useState(currentSearch);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(newPage));
    router.push(`?${params.toString()}`);
  };

  const handleCategoryChange = (categoryId: string | null) => {
    if (!categoryId) return;
    const params = new URLSearchParams(searchParams.toString());
    if (categoryId === 'all') params.delete('categoryId');
    else params.set('categoryId', categoryId);
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
    const res = await exportProductSalesReportCSVAction({
      branchId: selectedBranchId,
      preset: selectedPreset as DateRangePreset,
      startDate,
      endDate,
      categoryId: currentCategory,
      search: currentSearch,
    });
    return res.success ? res.csv : null;
  };

  const summaryCards: SummaryCardItem[] = [
    {
      label: 'Dishes Sold',
      value: formatNumber(summary.totalQuantitySold),
      icon: Package,
    },
    {
      label: 'Gross Sales',
      value: formatCurrency(summary.grossSales),
      icon: IndianRupee,
    },
    {
      label: 'Item Discounts',
      value: formatCurrency(summary.discounts),
      icon: Percent,
    },
    {
      label: 'Net Sales',
      value: formatCurrency(summary.netSales),
      icon: IndianRupee,
    },
    {
      label: 'Unique Items',
      value: formatNumber(summary.uniqueItemsCount),
      icon: UtensilsCrossed,
    },
  ];

  const extraFilters = (
    <>
      <form onSubmit={handleSearchSubmit} className="relative w-44">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Menu Item..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="h-9 pl-8 text-xs"
        />
      </form>

      {categories.length > 0 && (
        <div className="w-36">
          <Select value={currentCategory} onValueChange={handleCategoryChange}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  );

  return (
    <ReportViewContainer
      title="Product Sales Report"
      description="Menu item sales volumes, individual dish revenue, and category performance rankings."
      icon={UtensilsCrossed}
      branches={branches}
      selectedBranchId={selectedBranchId}
      isBranchRestricted={isBranchRestricted}
      selectedPreset={selectedPreset}
      startDate={startDate}
      endDate={endDate}
      summaryCards={summaryCards}
      pagination={pagination}
      onPageChange={handlePageChange}
      onExportCSV={handleExport}
      csvFilename={`products-report-${selectedPreset}-${new Date().toISOString().split('T')[0]}.csv`}
      extraFilters={extraFilters}
    >
      <Card className="border border-border/60 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="font-semibold">Menu Item</TableHead>
                  <TableHead className="font-semibold">Category</TableHead>
                  <TableHead className="font-semibold">Branch</TableHead>
                  <TableHead className="text-right font-semibold">Qty Sold</TableHead>
                  <TableHead className="text-right font-semibold">Gross Sales</TableHead>
                  <TableHead className="text-right font-semibold">Discounts</TableHead>
                  <TableHead className="text-right font-semibold">Net Sales</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                      No product sales recorded for the selected period.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((p, i) => (
                    <TableRow key={i} className="hover:bg-muted/20">
                      <TableCell className="font-semibold text-xs text-foreground">
                        {p.menuItemName}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[10px]">
                          {p.categoryName}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.branchName}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono font-medium text-foreground">
                        {formatNumber(p.quantitySold)}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono">
                        {formatCurrency(p.grossSales)}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono text-amber-600 dark:text-amber-400">
                        {p.discounts > 0 ? `-${formatCurrency(p.discounts)}` : '₹0.00'}
                      </TableCell>
                      <TableCell className="text-right text-xs font-bold font-mono text-primary">
                        {formatCurrency(p.netSales)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </ReportViewContainer>
  );
}
