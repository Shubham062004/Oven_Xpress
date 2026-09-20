'use client';

import React, { useState, useTransition, useMemo } from 'react';
import {
  UtensilsCrossed,
  Search,
  Layers,
  ArrowUpDown,
  DollarSign,
  Package,
  TrendingUp,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DateRangePicker } from '@/components/reports/date-range-picker';
import { BranchFilter } from '@/components/reports/branch-filter';
import { ReportCard } from '@/components/reports/report-card';
import { ReportTableWrapper } from '@/components/reports/report-table';
import { DistributionDonutChart } from '@/components/reports/report-chart';
import type {
  ReportDateRange,
  DateRangePreset,
  ProductSalesRow,
  CategorySalesRow,
} from '@/lib/reports/types';
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  downloadCSV,
} from '@/lib/reports/constants';
import {
  getProductSales,
  getCategorySales,
  exportProductSalesCSV,
} from '@/lib/reports/actions';

interface ProductSalesClientProps {
  initialProducts: ProductSalesRow[];
  initialCategories: CategorySalesRow[];
  branches: Array<{ id: string; name: string; code: string }>;
  isBranchRestricted: boolean;
  selectedBranchId?: string;
  initialDateRange: ReportDateRange;
  initialPreset?: DateRangePreset;
}

export function ProductSalesClient({
  initialProducts,
  initialCategories,
  branches,
  isBranchRestricted,
  selectedBranchId = 'all',
  initialDateRange,
  initialPreset = 'month',
}: ProductSalesClientProps) {
  const [isPending, startTransition] = useTransition();
  const [dateRange, setDateRange] = useState<ReportDateRange>(initialDateRange);
  const [preset, setPreset] = useState<DateRangePreset>(initialPreset);
  const [branchId, setBranchId] = useState<string>(selectedBranchId);

  const [products, setProducts] = useState<ProductSalesRow[]>(initialProducts);
  const [categories, setCategories] = useState<CategorySalesRow[]>(initialCategories);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortField, setSortField] = useState<'netSales' | 'quantitySold' | 'menuItemName'>('netSales');
  const [sortAsc, setSortAsc] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const reloadData = (newBranch: string, newRange: ReportDateRange) => {
    startTransition(async () => {
      const bId = newBranch === 'all' ? undefined : newBranch;
      const [prodRes, catRes] = await Promise.all([
        getProductSales({ branchId: bId, dateRange: newRange }),
        getCategorySales({ branchId: bId, dateRange: newRange }),
      ]);

      if (prodRes.success) setProducts(prodRes.data);
      if (catRes.success) setCategories(catRes.data);
    });
  };

  const handleRangeChange = (range: ReportDateRange, newPreset: DateRangePreset) => {
    setDateRange(range);
    setPreset(newPreset);
    reloadData(branchId, range);
  };

  const handleBranchChange = (newBranch: string) => {
    setBranchId(newBranch);
    reloadData(newBranch, dateRange);
  };

  const handleExportCSV = async () => {
    setExportLoading(true);
    try {
      const res = await exportProductSalesCSV({
        branchId: branchId === 'all' ? undefined : branchId,
        dateRange,
      });
      if (res.success && res.data) {
        const filename = `product-sales-${dateRange.startDate}-to-${dateRange.endDate}.csv`;
        downloadCSV(res.data, filename);
      }
    } catch (err) {
      console.error('Failed to export product sales CSV', err);
    } finally {
      setExportLoading(false);
    }
  };

  // Filtered & sorted products
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        const matchesSearch = p.menuItemName
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
        const matchesCategory =
          selectedCategory === 'all' || p.categoryId === selectedCategory;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortField === 'netSales') diff = a.netSales - b.netSales;
        else if (sortField === 'quantitySold') diff = a.quantitySold - b.quantitySold;
        else diff = a.menuItemName.localeCompare(b.menuItemName);
        return sortAsc ? diff : -diff;
      });
  }, [products, searchQuery, selectedCategory, sortField, sortAsc]);

  // Aggregate totals
  const totalQuantity = useMemo(
    () => products.reduce((acc, p) => acc + p.quantitySold, 0),
    [products]
  );
  const totalNetSales = useMemo(
    () => products.reduce((acc, p) => acc + p.netSales, 0),
    [products]
  );
  const totalDiscounts = useMemo(
    () => products.reduce((acc, p) => acc + p.discounts, 0),
    [products]
  );

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Header Controls ──────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-2 border-b border-border/40">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Product & Category Sales
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Detailed item velocity, historical sales pricing, discount impact, and category revenue share.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <BranchFilter
            branches={branches}
            value={branchId}
            onChange={handleBranchChange}
            isRestricted={isBranchRestricted}
          />
          <DateRangePicker
            value={dateRange}
            preset={preset}
            onChange={handleRangeChange}
          />
        </div>
      </div>

      {/* ─── KPI Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportCard
          title="Total Units Sold"
          value={formatNumber(totalQuantity)}
          subtitle={`${products.length} distinct menu items`}
          icon={<Package className="w-4 h-4" />}
          variant="primary"
          loading={isPending}
        />
        <ReportCard
          title="Net Product Sales"
          value={formatCurrency(totalNetSales)}
          subtitle="Realized item revenue"
          icon={<TrendingUp className="w-4 h-4" />}
          variant="success"
          loading={isPending}
        />
        <ReportCard
          title="Item Discounts"
          value={formatCurrency(totalDiscounts)}
          subtitle="Applied at order/item level"
          icon={<DollarSign className="w-4 h-4" />}
          variant="warning"
          loading={isPending}
        />
        <ReportCard
          title="Active Categories"
          value={formatNumber(categories.length)}
          subtitle="Categories with sales"
          icon={<Layers className="w-4 h-4" />}
          variant="info"
          loading={isPending}
        />
      </div>

      {/* ─── Tabs: Products vs Categories ──────────────────────────────────── */}
      <Tabs defaultValue="products" className="space-y-4">
        <TabsList className="bg-card/70 border border-border/60 p-1 rounded-xl">
          <TabsTrigger value="products" className="text-xs rounded-lg gap-1.5">
            <UtensilsCrossed className="w-3.5 h-3.5" /> Item Breakdown
          </TabsTrigger>
          <TabsTrigger value="categories" className="text-xs rounded-lg gap-1.5">
            <Layers className="w-3.5 h-3.5" /> Category Share
          </TabsTrigger>
        </TabsList>

        {/* ─── Product Sales Table ────────────────────────────────────────── */}
        <TabsContent value="products" className="space-y-4">
          <ReportTableWrapper
            title="Product Sales Report"
            description="Item-level sales using historical transaction prices (OrderItem.unitPrice)."
            onExportCSV={handleExportCSV}
            exportLoading={exportLoading}
            loading={isPending}
            empty={filteredProducts.length === 0}
            actionSlot={
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search item..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 pl-8 text-xs w-40 md:w-48 bg-background/80"
                  />
                </div>

                <Select value={selectedCategory} onValueChange={(val) => setSelectedCategory(val ?? 'all')}>
                  <SelectTrigger className="h-8 text-xs w-36 bg-background/80">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">
                      All Categories
                    </SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.categoryId} value={c.categoryId} className="text-xs">
                        {c.categoryName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            }
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead
                      className="text-xs font-semibold cursor-pointer select-none"
                      onClick={() => toggleSort('menuItemName')}
                    >
                      <div className="flex items-center gap-1">
                        Menu Item
                        <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                      </div>
                    </TableHead>
                    <TableHead className="text-xs font-semibold">Category</TableHead>
                    <TableHead
                      className="text-xs font-semibold text-right cursor-pointer select-none"
                      onClick={() => toggleSort('quantitySold')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Qty Sold
                        <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                      </div>
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-right">Gross Sales</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Discounts</TableHead>
                    <TableHead
                      className="text-xs font-semibold text-right cursor-pointer select-none"
                      onClick={() => toggleSort('netSales')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Net Sales
                        <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                      </div>
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-right">Orders</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((p) => (
                    <TableRow key={p.menuItemId} className="hover:bg-muted/30">
                      <TableCell className="text-xs font-medium">
                        {p.menuItemName}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[10px] h-5 bg-muted/40">
                          {p.categoryName}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-right font-semibold">
                        {formatNumber(p.quantitySold)}
                      </TableCell>
                      <TableCell className="text-xs text-right">
                        {formatCurrency(p.grossSales)}
                      </TableCell>
                      <TableCell className="text-xs text-right text-muted-foreground">
                        {p.discounts > 0 ? `-${formatCurrency(p.discounts)}` : '-'}
                      </TableCell>
                      <TableCell className="text-xs text-right font-bold text-foreground">
                        {formatCurrency(p.netSales)}
                      </TableCell>
                      <TableCell className="text-xs text-right text-muted-foreground">
                        {p.orderCount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ReportTableWrapper>
        </TabsContent>

        {/* ─── Category Share Tab ─────────────────────────────────────────── */}
        <TabsContent value="categories" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ReportTableWrapper
              title="Category Revenue Distribution"
              description="Revenue share by menu category."
            >
              <div className="p-4">
                <DistributionDonutChart
                  data={categories.map((c) => ({
                    name: c.categoryName,
                    value: c.revenue,
                  }))}
                  height={280}
                  valueFormatter={(v) => formatCurrency(v)}
                />
              </div>
            </ReportTableWrapper>

            <ReportTableWrapper
              title="Category Breakdown"
              description="Total quantity and sales volume per category."
              empty={categories.length === 0}
            >
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="text-xs font-semibold">Category</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Qty Sold</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Revenue</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((c) => (
                      <TableRow key={c.categoryId} className="hover:bg-muted/30">
                        <TableCell className="text-xs font-medium">{c.categoryName}</TableCell>
                        <TableCell className="text-xs text-right">
                          {formatNumber(c.quantitySold)}
                        </TableCell>
                        <TableCell className="text-xs text-right font-bold text-foreground">
                          {formatCurrency(c.revenue)}
                        </TableCell>
                        <TableCell className="text-xs text-right">
                          <Badge variant="secondary" className="text-[10px] h-5">
                            {formatPercent(c.percentage)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </ReportTableWrapper>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
