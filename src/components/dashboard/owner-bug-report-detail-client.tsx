'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Bug,
  Clock,
  RotateCw,
  CheckCircle2,
  XCircle,
  User,
  Mail,
  Phone,
  Globe,
  Monitor,
  Calendar,
  Image as ImageIcon,
  ExternalLink,
  ShieldCheck,
  Check,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BUG_CATEGORIES,
  type BugReportStatus,
} from '@/lib/validations/bug-reports';
import type { BugReportItem } from '@/lib/bug-reports/service';
import { updateBugReportStatusAction } from '@/lib/bug-reports/actions';

interface OwnerBugReportDetailClientProps {
  report: BugReportItem;
}

export function OwnerBugReportDetailClient({
  report: initialReport,
}: OwnerBugReportDetailClientProps) {
  const [report, setReport] = useState<BugReportItem>(initialReport);
  const [selectedStatus, setSelectedStatus] = useState<BugReportStatus>(
    initialReport.status
  );
  const [resolutionNote, setResolutionNote] = useState(
    initialReport.resolutionNote || ''
  );
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  const handleStatusUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      const res = await updateBugReportStatusAction(report.id, {
        status: selectedStatus,
        resolutionNote: resolutionNote.trim() || undefined,
      });

      if (res.success && res.data) {
        setReport(res.data);
        setFeedback({
          type: 'success',
          message: `Report status updated to ${selectedStatus} successfully.`,
        });
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Failed to update status.',
        });
      }
    });
  };

  const getStatusBadge = (status: BugReportStatus) => {
    switch (status) {
      case 'OPEN':
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1 font-semibold">
            <Clock className="w-3.5 h-3.5" /> Open
          </Badge>
        );
      case 'IN_PROGRESS':
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 gap-1 font-semibold">
            <RotateCw className="w-3.5 h-3.5 animate-spin" /> In Progress
          </Badge>
        );
      case 'RESOLVED':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
          </Badge>
        );
      case 'CLOSED':
        return (
          <Badge className="bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30 gap-1 font-semibold">
            <XCircle className="w-3.5 h-3.5" /> Closed
          </Badge>
        );
    }
  };

  const categoryMeta = BUG_CATEGORIES.find((c) => c.value === report.category);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ─── Back & Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          href="/owner/bug-reports"
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>Back to All Reports</span>
        </Link>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs text-muted-foreground">Status:</span>
          {getStatusBadge(report.status)}
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl text-xs sm:text-sm font-medium flex items-center gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30'
          }`}
        >
          {feedback.type === 'success' ? (
            <Check className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* ─── Main Details Card ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Bug info + Diagnostics + Screenshot (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-2xl border border-border/80 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-primary">
                    {report.reportNumber}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {categoryMeta?.label || report.category}
                  </Badge>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>
                    {new Date(report.createdAt).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
              </div>

              <CardTitle className="text-lg sm:text-xl font-extrabold text-foreground pt-2">
                {report.title}
              </CardTitle>
            </CardHeader>

            <CardContent className="pt-4 space-y-5">
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  <span>Report Description</span>
                </h4>
                <div className="p-4 rounded-xl bg-muted/30 border border-border/50 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                  {report.description}
                </div>
              </div>

              {/* Screenshot Attachment */}
              {report.screenshotUrl && (
                <div className="space-y-2 pt-2 border-t border-border/40">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-primary" />
                    <span>Attached Screenshot</span>
                  </h4>

                  <div className="relative rounded-2xl overflow-hidden border border-border/80 bg-muted/20 group max-w-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={report.screenshotUrl}
                      alt="Bug attachment preview"
                      className="w-full max-h-64 object-contain bg-black/5"
                    />
                    <div className="p-3 bg-card border-t border-border/50 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground truncate">
                        Owner-only authenticated view
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsImageModalOpen(true)}
                        className="rounded-xl h-8 text-xs gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Expand Screenshot</span>
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Diagnostic Context Card */}
          <Card className="rounded-2xl border border-border/80 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Monitor className="w-4 h-4 text-primary" />
                <span>Diagnostics & Client Environment</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-muted/20 border border-border/50 space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground block">
                    Page URL
                  </span>
                  {report.pageUrl ? (
                    <a
                      href={report.pageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-mono text-[11px] break-all flex items-center gap-1"
                    >
                      <span className="break-all">{report.pageUrl}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground">Not captured</span>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-muted/20 border border-border/50 space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground block">
                    Viewport / Screen
                  </span>
                  <span className="font-mono text-foreground text-[11px]">
                    {report.deviceInfo?.viewport
                      ? `Viewport: ${report.deviceInfo.viewport} • Screen: ${report.deviceInfo.screen || 'N/A'}`
                      : 'N/A'}
                  </span>
                </div>
              </div>

              {report.userAgent && (
                <div className="p-3 rounded-xl bg-muted/20 border border-border/50 space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground block">
                    User Agent
                  </span>
                  <p className="font-mono text-[11px] text-muted-foreground break-all leading-relaxed">
                    {report.userAgent}
                  </p>
                </div>
              )}

              {report.deviceInfo && Object.keys(report.deviceInfo).length > 0 && (
                <div className="p-3 rounded-xl bg-muted/20 border border-border/50 space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground block">
                    Device Metadata
                  </span>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {Object.entries(report.deviceInfo).map(([key, val]) => (
                      <span
                        key={key}
                        className="px-2 py-0.5 rounded-md bg-card border border-border/60 text-[11px] text-foreground font-mono"
                      >
                        <span className="text-muted-foreground">{key}: </span>
                        <span>{String(val)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Status Update + Reporter Details (1 col) */}
        <div className="space-y-6">
          {/* Status Management Form */}
          <Card className="rounded-2xl border border-border/80 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span>Manage Report Status</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleStatusUpdate} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="status" className="text-xs font-semibold">
                    Change Status
                  </Label>
                  <Select
                    value={selectedStatus}
                    onValueChange={(val) => setSelectedStatus(val as BugReportStatus)}
                  >
                    <SelectTrigger id="status" className="h-10 rounded-xl text-xs">
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="OPEN">Open</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                      <SelectItem value="RESOLVED">Resolved</SelectItem>
                      <SelectItem value="CLOSED">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="resolutionNote" className="text-xs font-semibold">
                    Resolution Note / Comment
                  </Label>
                  <Textarea
                    id="resolutionNote"
                    placeholder="Describe how the bug was fixed, deploy reference, or closing reason..."
                    rows={3}
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    className="rounded-xl text-xs resize-none"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isPending}
                  className="w-full h-10 rounded-xl text-xs font-semibold shadow-xs gap-1.5"
                >
                  {isPending ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Status Update</span>
                    </>
                  )}
                </Button>

                {report.resolvedAt && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-800 dark:text-emerald-300 space-y-1">
                    <span className="font-bold block">Resolution Details:</span>
                    <p>Resolved by: {report.resolvedBy || 'Owner'}</p>
                    <p>
                      Date:{' '}
                      {new Date(report.resolvedAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    {report.resolutionNote && (
                      <p className="italic pt-1 font-normal">&quot;{report.resolutionNote}&quot;</p>
                    )}
                  </div>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Reporter Details Card */}
          <Card className="rounded-2xl border border-border/80 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                <span>Reporter Contact</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-xs">
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground block font-medium">
                  Name
                </span>
                <p className="font-semibold text-foreground">
                  {report.user?.name || report.reporterName || 'Anonymous Guest'}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground block font-medium">
                  Email
                </span>
                {report.user?.email || report.reporterEmail ? (
                  <a
                    href={`mailto:${report.user?.email || report.reporterEmail}`}
                    className="text-primary hover:underline flex items-center gap-1.5 font-medium"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>{report.user?.email || report.reporterEmail}</span>
                  </a>
                ) : (
                  <p className="text-muted-foreground">Not provided</p>
                )}
              </div>

              {report.reporterPhone && (
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground block font-medium">
                    Phone
                  </span>
                  <a
                    href={`tel:${report.reporterPhone}`}
                    className="text-primary hover:underline flex items-center gap-1.5 font-medium"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{report.reporterPhone}</span>
                  </a>
                </div>
              )}

              <div className="pt-2 border-t border-border/40">
                <span className="text-[11px] text-muted-foreground block">
                  User Type
                </span>
                <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-foreground">
                  {report.user ? 'Authenticated Customer' : 'Guest Customer'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ─── High-Resolution Image Modal ──────────────────────────────────── */}
      {isImageModalOpen && report.screenshotUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsImageModalOpen(false)}
        >
          <div
            className="relative bg-card rounded-2xl max-w-4xl max-h-[90vh] overflow-hidden border border-border shadow-2xl p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-border/40">
              <span className="font-mono text-xs font-bold text-foreground">
                {report.reportNumber} — Screenshot Attachment
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsImageModalOpen(false)}
                className="rounded-xl h-8 px-2.5 text-xs"
              >
                Close
              </Button>
            </div>
            <div className="p-2 overflow-auto max-h-[75vh] flex items-center justify-center bg-black/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={report.screenshotUrl}
                alt="Full resolution bug screenshot"
                className="max-w-full h-auto rounded-lg object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
