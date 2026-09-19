import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck } from 'lucide-react';

export const metadata = {
  title: 'Settings',
  description: 'Restaurant and system configuration',
};

export default async function SettingsPage() {
  // Server-side guard: Enforces that user has 'settings.read' permission
  const user = await requirePermission(PERMISSIONS.SETTINGS_READ);

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Settings"
        description="Configure application preferences and access policies"
      />

      <Card className="border-border/80">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            <CardTitle className="text-lg">Access Control Verification</CardTitle>
          </div>
          <CardDescription>
            This page is strictly enforced at the server execution boundary via{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              requirePermission(&apos;settings.read&apos;)
            </code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Current Session Authorization
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>Authenticated as:</span>
              <span className="font-semibold text-foreground">{user.name}</span>
              <Badge variant="outline" className="font-semibold">{user.role}</Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              Granted Permissions: {user.permissions.join(', ')}
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            Only users with the <span className="font-mono text-xs text-foreground">settings.read</span> permission (OWNER, ADMIN, MANAGER) can access this page. Any attempt by STAFF to navigate to <code className="font-mono text-xs text-foreground">/settings</code> directly triggers an automatic server redirect to the 403 Access Denied page.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
