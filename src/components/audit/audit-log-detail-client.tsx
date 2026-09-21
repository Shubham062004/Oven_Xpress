'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ShieldCheck,
  Building2,
  User,
  Clock,
  Globe,
  Terminal,
  FileCode,
  Copy,
  Check,
  ExternalLink,
  Layers,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AuditLogDetail } from '@/lib/audit/audit-types';

interface AuditLogDetailClientProps {
  log: AuditLogDetail;
}

export function AuditLogDetailClient({ log }: AuditLogDetailClientProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (key: string, data: unknown) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getActionBadgeColor = (action: string) => {
    if (action.startsWith('AUTH_')) {
      return 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800';
    }
    if (action.includes('CREATE') || action.includes('APPROVE') || action.includes('RECEIVE')) {
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    }
    if (action.includes('UPDATE') || action.includes('TRANSFER') || action.includes('STATUS')) {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    }
    if (action.includes('ADJUST') || action.includes('WASTAGE')) {
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    }
    if (
      action.includes('CANCEL') ||
      action.includes('REJECT') ||
      action.includes('REFUND') ||
      action.includes('DEACTIVATE') ||
      action.includes('DELETE')
    ) {
      return 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    }
    return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700';
  };

  const getEntityRoute = (entityType: string, entityId: string | null): string | null => {
    if (!entityId) return null;
    switch (entityType) {
      case 'ORDER':
        return `/orders/${entityId}`;
      case 'PURCHASE_ORDER':
        return `/purchases/${entityId}`;
      case 'EMPLOYEE':
        return `/employees/${entityId}`;
      case 'BRANCH':
        return `/branches/${entityId}`;
      case 'EXPENSE':
        return `/expenses`;
      case 'MENU_ITEM':
        return `/menu`;
      case 'INVENTORY_ITEM':
      case 'STOCK_TRANSACTION':
        return `/inventory`;
      case 'ATTENDANCE':
        return `/attendance`;
      case 'SALARY':
      case 'SALARY_STRUCTURE':
      case 'SALARY_RECORD':
      case 'BONUS':
        return `/salary`;
      case 'CUSTOMER':
        return `/customers`;
      default:
        return null;
    }
  };

  const targetRoute = getEntityRoute(log.entityType, log.entityId);
  const diffEntries = Object.entries(log.diff);
  const formattedDate = new Date(log.createdAt).toLocaleString('en-IN', {
    dateStyle: 'full',
    timeStyle: 'medium',
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Navigation and Title */}
      <div>
        <Link
          href="/audit-logs"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Audit Logs
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <Badge
                variant="outline"
                className={`text-xs font-mono font-semibold px-2.5 py-0.5 border ${getActionBadgeColor(
                  log.action
                )}`}
              >
                {log.action}
              </Badge>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Audit Record #{log.id.slice(-8)}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-muted-foreground/70" />
              Recorded on {formattedDate}
            </p>
          </div>

          <Badge variant="outline" className="text-xs bg-muted/40 text-muted-foreground border-border/80 w-fit">
            Tamper-Proof Audit Record
          </Badge>
        </div>
      </div>

      {/* Description Banner */}
      <Card className="border-border/60 bg-muted/20 shadow-xs">
        <CardContent className="p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Event Description
            </p>
            <p className="text-base text-foreground font-medium mt-0.5 leading-relaxed">
              {log.description}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Metadata & Context Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Actor */}
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase">
              <User className="w-3.5 h-3.5" />
              Operator / Actor
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {log.actorName ? (
              <div>
                <p className="text-sm font-bold text-foreground truncate">{log.actorName}</p>
                <p className="text-xs text-muted-foreground truncate">{log.actorEmail || 'No email'}</p>
                <Badge variant="outline" className="text-[10px] mt-2 font-semibold uppercase bg-muted/60">
                  {log.actorRole || 'Staff'}
                </Badge>
              </div>
            ) : (
              <span className="text-sm italic text-muted-foreground">Automated System Process</span>
            )}
          </CardContent>
        </Card>

        {/* Branch Context */}
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase">
              <Building2 className="w-3.5 h-3.5" />
              Branch Scope
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {log.branchName ? (
              <div>
                <p className="text-sm font-bold text-foreground">{log.branchName}</p>
                <p className="text-xs text-muted-foreground">Code: {log.branchCode || 'N/A'}</p>
                <span className="text-[11px] text-muted-foreground block mt-1 font-mono">
                  ID: {log.branchId?.slice(-8) || ''}
                </span>
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold text-foreground">Global System</p>
                <p className="text-xs text-muted-foreground">Not scoped to any branch</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Affected Entity */}
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase">
              <Layers className="w-3.5 h-3.5" />
              Target Entity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-sm font-bold text-foreground">{log.entityType}</p>
            {log.entityId ? (
              <div className="mt-1">
                <code className="text-xs font-mono bg-muted/80 px-1.5 py-0.5 rounded text-foreground/80 break-all">
                  {log.entityId}
                </code>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">No specific ID</span>
            )}
          </CardContent>
        </Card>

        {/* Network Context */}
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase">
              <Globe className="w-3.5 h-3.5" />
              Client Network
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground">
                IP: <span className="font-mono text-muted-foreground">{log.ipAddress || '127.0.0.1'}</span>
              </p>
              <p className="text-[11px] text-muted-foreground truncate" title={log.userAgent || 'Server Context'}>
                UA: {log.userAgent || 'Internal Server Action'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Target Entity Deep Link Card */}
      {targetRoute && (
        <Card className="border-primary/20 bg-primary/5 shadow-xs">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">
                  Linked Entity: {log.entityType} ({log.entityId?.slice(-8)})
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Branch-level permissions will be verified upon navigation to ensure strict isolation.
              </p>
            </div>

            <Link
              href={targetRoute}
              className="inline-flex items-center justify-center gap-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-2 transition-colors whitespace-nowrap shadow-xs"
            >
              <span>Inspect {log.entityType}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Computed Field Diff Section */}
      {diffEntries.length > 0 ? (
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="p-4 pb-3 border-b border-border/40">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Terminal className="w-4 h-4 text-primary" />
              Structured Changes Diff ({diffEntries.length} field{diffEntries.length > 1 ? 's' : ''})
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Direct comparison of field values before and after this operation.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/40">
              {diffEntries.map(([field, delta]) => (
                <div key={field} className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-center hover:bg-muted/10 transition-colors">
                  <div className="md:col-span-3">
                    <span className="font-mono text-xs font-semibold text-foreground px-2 py-1 bg-muted/60 rounded">
                      {field}
                    </span>
                  </div>

                  <div className="md:col-span-4 bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 rounded p-2 text-xs">
                    <p className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 mb-0.5">
                      Before
                    </p>
                    <pre className="font-mono text-xs text-rose-900 dark:text-rose-200 whitespace-pre-wrap break-all">
                      {delta.from === undefined ? '<undefined>' : JSON.stringify(delta.from, null, 2)}
                    </pre>
                  </div>

                  <div className="md:col-span-1 flex justify-center text-muted-foreground">
                    <ArrowRight className="w-4 h-4 hidden md:block" />
                    <span className="text-xs md:hidden">became</span>
                  </div>

                  <div className="md:col-span-4 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 rounded p-2 text-xs">
                    <p className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 mb-0.5">
                      After
                    </p>
                    <pre className="font-mono text-xs text-emerald-900 dark:text-emerald-200 whitespace-pre-wrap break-all">
                      {delta.to === undefined ? '<undefined>' : JSON.stringify(delta.to, null, 2)}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/40 bg-muted/10 shadow-xs">
          <CardContent className="p-4 text-center text-muted-foreground text-xs">
            No scalar field modifications detected (this record is an initial creation or non-diff mutation).
          </CardContent>
        </Card>
      )}

      {/* Raw Payloads (Sanitized) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Before State */}
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between border-b border-border/40">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5" />
              Before State
            </CardTitle>
            {log.beforeData && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-1.5"
                onClick={() => handleCopy('before', log.beforeData)}
              >
                {copiedField === 'before' ? (
                  <Check className="w-3 h-3 text-emerald-500" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-3">
            {log.beforeData ? (
              <pre className="bg-muted/40 p-2.5 rounded text-[11px] font-mono text-foreground overflow-x-auto max-h-60">
                {JSON.stringify(log.beforeData, null, 2)}
              </pre>
            ) : (
              <p className="text-xs text-muted-foreground italic">None</p>
            )}
          </CardContent>
        </Card>

        {/* After State */}
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between border-b border-border/40">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5" />
              After State
            </CardTitle>
            {log.afterData && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-1.5"
                onClick={() => handleCopy('after', log.afterData)}
              >
                {copiedField === 'after' ? (
                  <Check className="w-3 h-3 text-emerald-500" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-3">
            {log.afterData ? (
              <pre className="bg-muted/40 p-2.5 rounded text-[11px] font-mono text-foreground overflow-x-auto max-h-60">
                {JSON.stringify(log.afterData, null, 2)}
              </pre>
            ) : (
              <p className="text-xs text-muted-foreground italic">None</p>
            )}
          </CardContent>
        </Card>

        {/* Metadata */}
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between border-b border-border/40">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5" />
              Operational Metadata
            </CardTitle>
            {log.metadata && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-1.5"
                onClick={() => handleCopy('metadata', log.metadata)}
              >
                {copiedField === 'metadata' ? (
                  <Check className="w-3 h-3 text-emerald-500" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-3">
            {log.metadata ? (
              <pre className="bg-muted/40 p-2.5 rounded text-[11px] font-mono text-foreground overflow-x-auto max-h-60">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            ) : (
              <p className="text-xs text-muted-foreground italic">None</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
