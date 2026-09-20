'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShoppingBag,
  ArrowLeft,
  Plus,
  Trash2,
  Building2,
  Truck,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { IngredientUnit, PurchaseOrderStatus } from '@prisma/client';

import { createPurchaseOrder } from '@/lib/purchases/actions';

import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface BranchOption {
  id: string;
  name: string;
  code: string;
}

interface SupplierOption {
  id: string;
  name: string;
}

interface IngredientOption {
  id: string;
  name: string;
  unit: IngredientUnit;
}

interface PurchaseFormClientProps {
  branches: BranchOption[];
  suppliers: SupplierOption[];
  ingredients: IngredientOption[];
  userBranchId?: string | null;
  isManager: boolean;
}

interface FormLineItem {
  id: string; // client temporary ID
  ingredientId: string;
  orderedQuantity: string;
  unit: IngredientUnit;
  unitPrice: string;
}

export function PurchaseFormClient({
  branches,
  suppliers,
  ingredients,
  userBranchId,
  isManager,
}: PurchaseFormClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedSupplierId = searchParams.get('supplierId') || '';

  const [isPending, startTransition] = useTransition();

  const [supplierId, setSupplierId] = useState<string>(
    suppliers.find((s) => s.id === preselectedSupplierId)?.id ??
      (suppliers.length > 0 ? suppliers[0].id : '')
  );

  const [branchId, setBranchId] = useState<string>(
    isManager && userBranchId
      ? userBranchId
      : branches.length > 0
        ? branches[0].id
        : ''
  );

  const [orderDate, setOrderDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [expectedDate, setExpectedDate] = useState<string>('');
  const [status, setStatus] = useState<PurchaseOrderStatus>(PurchaseOrderStatus.ORDERED);
  const [notes, setNotes] = useState<string>('');

  const [lineItems, setLineItems] = useState<FormLineItem[]>([
    {
      id: 'item-1',
      ingredientId: ingredients.length > 0 ? ingredients[0].id : '',
      orderedQuantity: '10',
      unit: ingredients.length > 0 ? ingredients[0].unit : IngredientUnit.KG,
      unitPrice: '100',
    },
  ]);

  const [error, setError] = useState<string | null>(null);

  // Line item modifiers
  const handleAddLine = () => {
    // Pick an ingredient not yet in the list if available
    const usedIds = new Set(lineItems.map((i) => i.ingredientId));
    const available = ingredients.find((i) => !usedIds.has(i.id)) || ingredients[0];

    setLineItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random()}`,
        ingredientId: available ? available.id : '',
        orderedQuantity: '10',
        unit: available ? available.unit : IngredientUnit.KG,
        unitPrice: '50',
      },
    ]);
    setError(null);
  };

  const handleRemoveLine = (id: string) => {
    if (lineItems.length <= 1) {
      toast.error('Purchase order must contain at least one ingredient');
      return;
    }
    setLineItems((prev) => prev.filter((i) => i.id !== id));
    setError(null);
  };

  const handleIngredientChange = (id: string, newIngredientId: string) => {
    const selected = ingredients.find((i) => i.id === newIngredientId);
    if (!selected) return;

    setLineItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              ingredientId: newIngredientId,
              unit: selected.unit,
            }
          : item
      )
    );
    setError(null);
  };

  const handleQuantityChange = (id: string, qty: string) => {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, orderedQuantity: qty } : item))
    );
    setError(null);
  };

  const handlePriceChange = (id: string, price: string) => {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, unitPrice: price } : item))
    );
    setError(null);
  };

  // Calculations
  const calculatedItems = lineItems.map((item) => {
    const qty = parseFloat(item.orderedQuantity) || 0;
    const prc = parseFloat(item.unitPrice) || 0;
    const lineTotal = qty * prc;
    return {
      ...item,
      lineTotal: Math.round(lineTotal * 100) / 100,
    };
  });

  const subtotal = calculatedItems.reduce((sum, item) => sum + item.lineTotal, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!supplierId) {
      setError('Please select a supplier');
      return;
    }

    if (!branchId) {
      setError('Please select a destination branch');
      return;
    }

    if (lineItems.length === 0) {
      setError('Please add at least one ingredient item');
      return;
    }

    // Check for duplicate ingredients
    const seenIds = new Set<string>();
    for (const item of lineItems) {
      if (!item.ingredientId) {
        setError('All line items must have a selected ingredient');
        return;
      }
      if (seenIds.has(item.ingredientId)) {
        const ing = ingredients.find((i) => i.id === item.ingredientId);
        setError(`Duplicate ingredient "${ing?.name || 'Selected'}". Each ingredient can only be listed once.`);
        return;
      }
      seenIds.add(item.ingredientId);

      const qty = parseFloat(item.orderedQuantity);
      if (isNaN(qty) || qty <= 0) {
        const ing = ingredients.find((i) => i.id === item.ingredientId);
        setError(`Quantity for "${ing?.name || 'item'}" must be greater than 0.`);
        return;
      }

      const prc = parseFloat(item.unitPrice);
      if (isNaN(prc) || prc < 0) {
        const ing = ingredients.find((i) => i.id === item.ingredientId);
        setError(`Unit price for "${ing?.name || 'item'}" cannot be negative.`);
        return;
      }
    }

    const payload = {
      supplierId,
      branchId,
      orderDate: orderDate ? new Date(orderDate).toISOString() : undefined,
      expectedDate: expectedDate ? new Date(expectedDate).toISOString() : undefined,
      status: status as 'DRAFT' | 'ORDERED',
      notes: notes.trim() || undefined,
      items: lineItems.map((item) => ({
        ingredientId: item.ingredientId,
        orderedQuantity: parseFloat(item.orderedQuantity),
        unit: item.unit,
        unitPrice: parseFloat(item.unitPrice),
      })),
    };

    startTransition(async () => {
      try {
        const res = await createPurchaseOrder(payload);

        if (!res.success || !res.data) {
          setError(res.error || 'Failed to create purchase order');
          toast.error(res.error || 'Failed to create purchase order');
          return;
        }

        toast.success(`Purchase order ${res.data.purchaseNumber} created successfully!`);
        router.push(`/purchases/${res.data.id}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'An unexpected error occurred';
        setError(msg);
        toast.error(msg);
      }
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back Link & Header */}
      <div className="space-y-2">
        <Link
          href="/purchases"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to Purchase Orders
        </Link>

        <PageHeader
          title="Create Purchase Order"
          description="Order raw materials and ingredients from registered suppliers for branch inventory replenishment."
        />
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/15 border border-destructive/30 p-4 text-sm text-destructive flex items-center gap-2.5">
          <AlertCircle className="size-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Order Setup Card */}
        <Card className="border-border/60 shadow-xs">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingBag className="size-4 text-primary" />
              Order Details & Destination
            </CardTitle>
            <CardDescription>
              Select the vendor and destination restaurant branch
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Supplier Selector */}
            <div className="space-y-1.5">
              <Label htmlFor="supplier" className="text-xs">
                Supplier Vendor <span className="text-destructive">*</span>
              </Label>
              <Select value={supplierId} onValueChange={(val) => val && setSupplierId(val)}>
                <SelectTrigger id="supplier" className="h-10">
                  <div className="flex items-center gap-2">
                    <Truck className="size-4 text-muted-foreground" />
                    <SelectValue placeholder="Select supplier..." />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Branch Selector */}
            <div className="space-y-1.5">
              <Label htmlFor="branch" className="text-xs">
                Receiving Branch <span className="text-destructive">*</span>
              </Label>
              <Select
                value={branchId}
                onValueChange={(val) => val && setBranchId(val)}
                disabled={isManager}
              >
                <SelectTrigger id="branch" className="h-10">
                  <div className="flex items-center gap-2">
                    <Building2 className="size-4 text-muted-foreground" />
                    <SelectValue placeholder="Select branch..." />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isManager && (
                <p className="text-[11px] text-muted-foreground">
                  Locked to your assigned managerial branch.
                </p>
              )}
            </div>

            {/* Order Date */}
            <div className="space-y-1.5">
              <Label htmlFor="order-date" className="text-xs">
                Order Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="order-date"
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="h-10 text-sm"
              />
            </div>

            {/* Expected Delivery Date */}
            <div className="space-y-1.5">
              <Label htmlFor="expected-date" className="text-xs">
                Expected Delivery Date (Optional)
              </Label>
              <Input
                id="expected-date"
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className="h-10 text-sm"
              />
            </div>

            {/* Order Status */}
            <div className="space-y-1.5">
              <Label htmlFor="order-status" className="text-xs">
                Initial Status
              </Label>
              <Select
                value={status}
                onValueChange={(val) => val && setStatus(val as PurchaseOrderStatus)}
              >
                <SelectTrigger id="order-status" className="h-10">
                  <SelectValue placeholder="Select initial status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PurchaseOrderStatus.ORDERED}>
                    ORDERED — Ready for vendor delivery & receiving
                  </SelectItem>
                  <SelectItem value={PurchaseOrderStatus.DRAFT}>
                    DRAFT — Editable internal draft
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="order-notes" className="text-xs">
                Operational Notes / Delivery Instructions
              </Label>
              <Input
                id="order-notes"
                placeholder="e.g. Urgent morning delivery before 10 AM"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-10 text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* Line Items Card */}
        <Card className="border-border/60 shadow-xs overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">Order Items & Quantities</CardTitle>
              <CardDescription>
                Add raw ingredients, specify required quantity and agreed unit price
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddLine}
              className="gap-1.5 h-8"
            >
              <Plus className="size-3.5" />
              Add Ingredient
            </Button>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold text-xs min-w-[220px]">
                      Ingredient <span className="text-destructive">*</span>
                    </TableHead>
                    <TableHead className="font-semibold text-xs w-28 text-center">Unit</TableHead>
                    <TableHead className="font-semibold text-xs w-36 text-right">
                      Quantity <span className="text-destructive">*</span>
                    </TableHead>
                    <TableHead className="font-semibold text-xs w-36 text-right">
                      Unit Price (₹) <span className="text-destructive">*</span>
                    </TableHead>
                    <TableHead className="font-semibold text-xs w-36 text-right">
                      Line Total (₹)
                    </TableHead>
                    <TableHead className="w-12 text-center"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calculatedItems.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/20">
                      {/* Ingredient Selector */}
                      <TableCell>
                        <Select
                          value={item.ingredientId}
                          onValueChange={(val) => val && handleIngredientChange(item.id, val)}
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue placeholder="Select ingredient..." />
                          </SelectTrigger>
                          <SelectContent>
                            {ingredients.map((ing) => (
                              <SelectItem key={ing.id} value={ing.id}>
                                {ing.name} ({ing.unit})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>

                      {/* Unit Badge */}
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-mono text-xs">
                          {item.unit}
                        </Badge>
                      </TableCell>

                      {/* Quantity */}
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.001"
                          min="0.001"
                          placeholder="0.00"
                          value={item.orderedQuantity}
                          onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                          className="h-9 text-right text-xs"
                          required
                        />
                      </TableCell>

                      {/* Unit Price */}
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={item.unitPrice}
                          onChange={(e) => handlePriceChange(item.id, e.target.value)}
                          className="h-9 text-right text-xs"
                          required
                        />
                      </TableCell>

                      {/* Line Total */}
                      <TableCell className="text-right font-medium text-xs">
                        ₹{item.lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>

                      {/* Delete Action */}
                      <TableCell className="text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleRemoveLine(item.id)}
                          disabled={lineItems.length <= 1}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                          <span className="sr-only">Remove item</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col sm:flex-row items-center justify-between p-4 bg-muted/20 border-t border-border/60 gap-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddLine}
              className="gap-1.5"
            >
              <Plus className="size-3.5" />
              Add Another Ingredient
            </Button>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <span className="text-xs text-muted-foreground block">
                  Total Items: {lineItems.length}
                </span>
                <span className="text-sm font-semibold text-muted-foreground">
                  Estimated Subtotal:
                </span>
              </div>
              <div className="text-2xl font-bold text-foreground">
                ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </CardFooter>
        </Card>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/purchases')}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending} className="gap-2 min-w-[160px]">
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Generating Order...
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4" />
                Place Purchase Order
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
