'use client';

import { useState } from 'react';
import { Copy, Check, ShieldAlert, KeyRound, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface CredentialDeliveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeName: string;
  loginId: string;
  temporaryPassword: string;
}

export function CredentialDeliveryDialog({
  open,
  onOpenChange,
  employeeName,
  loginId,
  temporaryPassword,
}: CredentialDeliveryDialogProps) {
  const [copiedField, setCopiedField] = useState<'login' | 'password' | 'all' | null>(null);

  const copyToClipboard = async (text: string, field: 'login' | 'password' | 'all') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success(
        field === 'all'
          ? 'Credentials copied to clipboard'
          : `${field === 'login' ? 'Login ID' : 'Password'} copied to clipboard`
      );
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const copyBoth = () => {
    const text = `Oven Xpress Staff Login Credentials\nEmployee: ${employeeName}\nLogin ID / Email: ${loginId}\nTemporary Password: ${temporaryPassword}`;
    copyToClipboard(text, 'all');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <KeyRound className="size-5" />
            </div>
            <div>
              <DialogTitle>System Login Account Created</DialogTitle>
              <DialogDescription>
                Credentials generated for <span className="font-semibold text-foreground">{employeeName}</span>.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Security Alert Banner */}
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
            <ShieldAlert className="size-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium">Confidential One-Time Display</p>
              <p className="text-muted-foreground dark:text-amber-300/80">
                For security reasons, this temporary password is never stored in plain text and will not be displayed again after closing this dialog. Please securely share it with the employee.
              </p>
            </div>
          </div>

          {/* Credentials Display */}
          <div className="space-y-3 rounded-lg border border-border/80 bg-muted/40 p-4">
            {/* Login ID */}
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Login ID / Email</span>
              <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
                <span className="font-mono text-sm select-all">{loginId}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => copyToClipboard(loginId, 'login')}
                  title="Copy Login ID"
                  aria-label="Copy Login ID"
                >
                  {copiedField === 'login' ? (
                    <Check className="size-3.5 text-green-600" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </Button>
              </div>
            </div>

            {/* Temporary Password */}
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Temporary Password</span>
              <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
                <span className="font-mono text-sm tracking-wider select-all">{temporaryPassword}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => copyToClipboard(temporaryPassword, 'password')}
                  title="Copy Password"
                  aria-label="Copy Password"
                >
                  {copiedField === 'password' ? (
                    <Check className="size-3.5 text-green-600" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={copyBoth}
            className="flex items-center gap-1.5"
          >
            {copiedField === 'all' ? (
              <>
                <Check className="size-4 text-green-600" />
                Copied Credentials
              </>
            ) : (
              <>
                <Copy className="size-4" />
                Copy Both
              </>
            )}
          </Button>
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
