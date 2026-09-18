'use client';

import { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Info,
  AlertTriangle,
  Package,
  Plus,
  MoreHorizontal,
  Trash2,
  Edit,
  Copy,
} from 'lucide-react';

import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import {
  CardSkeleton,
  TableSkeleton,
  FormSkeleton,
} from '@/components/ui/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

const SAMPLE_TABLE_DATA = [
  { name: 'Sample Item A', status: 'Active', category: 'Type 1', value: '100' },
  { name: 'Sample Item B', status: 'Inactive', category: 'Type 2', value: '250' },
  { name: 'Sample Item C', status: 'Active', category: 'Type 1', value: '75' },
  { name: 'Sample Item D', status: 'Pending', category: 'Type 3', value: '320' },
];

export default function DesignSystemPage() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Design System"
        description="Component library and design tokens reference. All content below is sample data for demonstration."
      />

      {/* ── Buttons ── */}
      <section aria-labelledby="buttons-heading">
        <h2 id="buttons-heading" className="mb-4 text-lg font-semibold">
          Buttons
        </h2>
        <Card>
          <CardContent className="flex flex-wrap gap-3 pt-6">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
            <Button disabled>Disabled</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" aria-label="Add item">
              <Plus />
            </Button>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* ── Cards ── */}
      <section aria-labelledby="cards-heading">
        <h2 id="cards-heading" className="mb-4 text-lg font-semibold">
          Cards
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>Sample Metric</CardDescription>
              <CardTitle className="text-2xl">1,234</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Demo value — not real data
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Another Metric</CardDescription>
              <CardTitle className="text-2xl">567</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Demo value — not real data
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Third Metric</CardDescription>
              <CardTitle className="text-2xl">89%</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Demo value — not real data
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <Separator />

      {/* ── Badges ── */}
      <section aria-labelledby="badges-heading">
        <h2 id="badges-heading" className="mb-4 text-lg font-semibold">
          Badges
        </h2>
        <Card>
          <CardContent className="flex flex-wrap gap-3 pt-6">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge className="border-success/30 bg-success/10 text-success">
              Success
            </Badge>
            <Badge className="border-warning/30 bg-warning/10 text-warning">
              Warning
            </Badge>
            <Badge className="border-info/30 bg-info/10 text-info">Info</Badge>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* ── Form Inputs ── */}
      <section aria-labelledby="inputs-heading">
        <h2 id="inputs-heading" className="mb-4 text-lg font-semibold">
          Form Inputs
        </h2>
        <Card>
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="demo-input">Text Input</Label>
              <Input id="demo-input" placeholder="Enter text..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="demo-disabled">Disabled Input</Label>
              <Input id="demo-disabled" placeholder="Disabled" disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="demo-select">Select</Label>
              <Select>
                <SelectTrigger id="demo-select">
                  <SelectValue placeholder="Choose an option" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="option-1">Option 1</SelectItem>
                  <SelectItem value="option-2">Option 2</SelectItem>
                  <SelectItem value="option-3">Option 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="demo-search">Search Input</Label>
              <Input id="demo-search" type="search" placeholder="Search..." />
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* ── Table ── */}
      <section aria-labelledby="table-heading">
        <h2 id="table-heading" className="mb-4 text-lg font-semibold">
          Table
        </h2>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-30">Name</TableHead>
                    <TableHead className="min-w-25">Status</TableHead>
                    <TableHead className="min-w-25">Category</TableHead>
                    <TableHead className="min-w-20 text-right">
                      Value
                    </TableHead>
                    <TableHead className="w-12">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SAMPLE_TABLE_DATA.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            row.status === 'Active'
                              ? 'default'
                              : row.status === 'Inactive'
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.category}</TableCell>
                      <TableCell className="text-right">{row.value}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                aria-label={`Actions for ${row.name}`}
                              />
                            }
                          >
                            <MoreHorizontal />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Edit className="mr-2 size-3.5" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Copy className="mr-2 size-3.5" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="mr-2 size-3.5" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* ── Dialog ── */}
      <section aria-labelledby="dialog-heading">
        <h2 id="dialog-heading" className="mb-4 text-lg font-semibold">
          Dialog
        </h2>
        <Card>
          <CardContent className="pt-6">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger render={<Button variant="outline" />}>
                Open Dialog
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Sample Dialog</DialogTitle>
                  <DialogDescription>
                    This is a demonstration dialog. No action will be performed.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="dialog-input">Sample Field</Label>
                    <Input id="dialog-input" placeholder="Enter something..." />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={() => setDialogOpen(false)}>Confirm</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* ── Tabs ── */}
      <section aria-labelledby="tabs-heading">
        <h2 id="tabs-heading" className="mb-4 text-lg font-semibold">
          Tabs
        </h2>
        <Card>
          <CardContent className="pt-6">
            <Tabs defaultValue="tab-1">
              <TabsList>
                <TabsTrigger value="tab-1">Overview</TabsTrigger>
                <TabsTrigger value="tab-2">Details</TabsTrigger>
                <TabsTrigger value="tab-3">Settings</TabsTrigger>
              </TabsList>
              <TabsContent value="tab-1" className="mt-4">
                <p className="text-sm text-muted-foreground">
                  Overview tab content. This is sample content for
                  demonstration.
                </p>
              </TabsContent>
              <TabsContent value="tab-2" className="mt-4">
                <p className="text-sm text-muted-foreground">
                  Details tab content. This is sample content for
                  demonstration.
                </p>
              </TabsContent>
              <TabsContent value="tab-3" className="mt-4">
                <p className="text-sm text-muted-foreground">
                  Settings tab content. This is sample content for
                  demonstration.
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* ── Tooltip ── */}
      <section aria-labelledby="tooltip-heading">
        <h2 id="tooltip-heading" className="mb-4 text-lg font-semibold">
          Tooltip
        </h2>
        <Card>
          <CardContent className="flex gap-3 pt-6">
            <Tooltip>
              <TooltipTrigger render={<Button variant="outline" />}>
                Hover me
              </TooltipTrigger>
              <TooltipContent>
                <p>This is a tooltip</p>
              </TooltipContent>
            </Tooltip>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* ── Alerts ── */}
      <section aria-labelledby="alerts-heading">
        <h2 id="alerts-heading" className="mb-4 text-lg font-semibold">
          Alerts
        </h2>
        <div className="space-y-3">
          <Alert>
            <Info className="size-4" />
            <AlertTitle>Information</AlertTitle>
            <AlertDescription>
              This is an informational alert for general messages.
            </AlertDescription>
          </Alert>
          <Alert className="border-success/30 bg-success/5 text-success [&>svg]:text-success">
            <CheckCircle2 className="size-4" />
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>
              Operation completed successfully.
            </AlertDescription>
          </Alert>
          <Alert className="border-warning/30 bg-warning/5 text-warning [&>svg]:text-warning">
            <AlertTriangle className="size-4" />
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>
              Please review before continuing.
            </AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              Something went wrong. Please try again or contact support.
            </AlertDescription>
          </Alert>
        </div>
      </section>

      <Separator />

      {/* ── Toast ── */}
      <section aria-labelledby="toast-heading">
        <h2 id="toast-heading" className="mb-4 text-lg font-semibold">
          Toast Notifications
        </h2>
        <Card>
          <CardContent className="flex flex-wrap gap-3 pt-6">
            <Button
              variant="outline"
              onClick={() => toast('Default notification')}
            >
              Default Toast
            </Button>
            <Button
              variant="outline"
              onClick={() => toast.success('Operation successful')}
            >
              Success Toast
            </Button>
            <Button
              variant="outline"
              onClick={() => toast.error('Something went wrong')}
            >
              Error Toast
            </Button>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* ── Loading States ── */}
      <section aria-labelledby="loading-heading">
        <h2 id="loading-heading" className="mb-4 text-lg font-semibold">
          Loading States (Skeletons)
        </h2>
        <div className="space-y-6">
          <div>
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">
              Card Skeletons
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">
              Table Skeleton
            </h3>
            <TableSkeleton rows={3} columns={4} />
          </div>
          <div>
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">
              Form Skeleton
            </h3>
            <Card>
              <CardContent className="pt-6">
                <FormSkeleton fields={3} />
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <Separator />

      {/* ── Empty State ── */}
      <section aria-labelledby="empty-heading">
        <h2 id="empty-heading" className="mb-4 text-lg font-semibold">
          Empty State
        </h2>
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={Package}
              title="No data available yet"
              description="This is a reusable empty state component. When data is available, it will appear here."
              action={{
                label: 'Add Item',
                onClick: () => toast('Action placeholder'),
              }}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
