import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Bug, HelpCircle, ShieldAlert } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/guards';
import { ReportBugForm } from '@/components/customer/report-bug-form';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Report a Bug | Oven Xpress',
  description: 'Report a technical issue, bug, or glitch on Oven Xpress to our technical engineering team.',
};

export default async function ReportBugPage() {
  const user = await getCurrentUser();

  return (
    <div className="min-h-screen bg-muted/20 py-8 sm:py-12 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Top Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to Store</span>
          </Link>

          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 bg-background px-3 py-1 rounded-full border border-border/60">
            <ShieldAlert className="w-3.5 h-3.5 text-primary" />
            Customer Bug Portal
          </span>
        </div>

        {/* The Main Bug Reporting Form */}
        <ReportBugForm
          initialUser={
            user
              ? {
                  name: user.name,
                  email: user.email,
                  phone: null,
                }
              : null
          }
        />

        {/* Helpful Support Footer Notice */}
        <div className="max-w-xl mx-auto text-center space-y-2 pt-4">
          <p className="text-xs text-muted-foreground">
            For urgent food order delays or order cancellations, please reach out to your local branch
            or check your{' '}
            <Link href="/account/orders" className="text-primary underline hover:text-primary/80">
              order tracking
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
