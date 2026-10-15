'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Bug,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  X,
  Globe,
  Loader2,
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  type BugReportCategory,
} from '@/lib/validations/bug-reports';
import { submitBugReportAction } from '@/lib/bug-reports/actions';

interface ReportBugFormProps {
  initialUser?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
}

export function ReportBugForm({ initialUser }: ReportBugFormProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<BugReportCategory>('OTHER');
  const [description, setDescription] = useState('');
  const [reporterName, setReporterName] = useState(initialUser?.name || '');
  const [reporterEmail, setReporterEmail] = useState(initialUser?.email || '');
  const [reporterPhone, setReporterPhone] = useState(initialUser?.phone || '');
  const [pageUrl, setPageUrl] = useState('');
  const [deviceInfo, setDeviceInfo] = useState<Record<string, unknown>>({});

  // File upload state
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successReport, setSuccessReport] = useState<{
    reportNumber: string;
    title: string;
    category: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Auto-detect page URL and device diagnostic details asynchronously
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const timer = setTimeout(() => {
      const searchParams = new URLSearchParams(window.location.search);
      const refUrl = searchParams.get('url') || document.referrer || window.location.href;
      setPageUrl(refUrl);

      const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
      const diag: Record<string, unknown> = {
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
        devicePixelRatio: window.devicePixelRatio || 1,
        language: navigator.language || 'en',
        platform: nav.userAgentData?.platform || navigator.platform || 'Unknown',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
      setDeviceInfo(diag);
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const selected = e.target.files?.[0];
    if (!selected) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(selected.type)) {
      setFileError('Only JPG, PNG, and WEBP image files are supported.');
      return;
    }

    if (selected.size > 5 * 1024 * 1024) {
      setFileError(
        `Image size is too large (${(selected.size / (1024 * 1024)).toFixed(1)}MB). Limit is 5MB.`
      );
      return;
    }

    setFile(selected);
    const objectUrl = URL.createObjectURL(selected);
    setPreviewUrl(objectUrl);
  };

  const removeFile = () => {
    setFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setFileError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (title.trim().length < 3) {
      setError('Please provide a short bug title (minimum 3 characters).');
      return;
    }

    if (description.trim().length < 10) {
      setError('Please provide a description of the issue (minimum 10 characters).');
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.set('title', title.trim());
      formData.set('category', category);
      formData.set('description', description.trim());

      if (reporterName.trim()) formData.set('reporterName', reporterName.trim());
      if (reporterEmail.trim()) formData.set('reporterEmail', reporterEmail.trim());
      if (reporterPhone.trim()) formData.set('reporterPhone', reporterPhone.trim());
      if (pageUrl.trim()) formData.set('pageUrl', pageUrl.trim());

      if (deviceInfo && Object.keys(deviceInfo).length > 0) {
        formData.set('deviceInfo', JSON.stringify(deviceInfo));
      }

      if (file) {
        formData.set('screenshot', file);
      }

      const res = await submitBugReportAction(formData);

      if (!res.success) {
        setError(res.error || 'Failed to submit bug report. Please try again.');
        setIsSubmitting(false);
        return;
      }

      setSuccessReport({
        reportNumber: res.reportNumber || 'BUG-OX',
        title: title.trim(),
        category,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'A network error occurred. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = () => {
    if (successReport) {
      navigator.clipboard.writeText(successReport.reportNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const resetForm = () => {
    setTitle('');
    setCategory('OTHER');
    setDescription('');
    removeFile();
    setSuccessReport(null);
    setError(null);
  };

  if (successReport) {
    return (
      <div className="bg-card border border-border/80 rounded-3xl p-6 sm:p-10 shadow-xl max-w-xl mx-auto text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/30">
          <CheckCircle2 className="w-9 h-9" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Bug Report Submitted!
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Thank you for helping us improve Oven Express. Our engineering team has been
            notified directly and will investigate the issue promptly.
          </p>
        </div>

        {/* Reference Number Card */}
        <div className="bg-muted/50 border border-border/70 rounded-2xl p-4 max-w-sm mx-auto flex items-center justify-between gap-3">
          <div className="text-left">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Reference Number
            </span>
            <span className="text-base font-mono font-bold text-primary">
              {successReport.reportNumber}
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="rounded-xl gap-1.5 h-9 text-xs"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy ID
              </>
            )}
          </Button>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={resetForm}
            className="rounded-xl h-11"
          >
            Report Another Issue
          </Button>
          <Link
            href="/"
            className={buttonVariants({ className: 'rounded-xl h-11 shadow-sm' })}
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-card border border-border/70 rounded-3xl p-5 sm:p-8 shadow-lg max-w-2xl mx-auto space-y-6"
    >
      {/* Header */}
      <div className="space-y-1.5 pb-2 border-b border-border/40">
        <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">
          <Bug className="w-4 h-4" />
          <span>System Bug Report</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
          Report a Technical Issue
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Encountered a bug, broken page, or payment glitch? Describe what happened below
          and we&apos;ll look into it right away.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-3 animate-in fade-in">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs sm:text-sm font-medium">{error}</div>
        </div>
      )}

      {/* Category Selection */}
      <div className="space-y-2">
        <Label htmlFor="category" className="text-xs sm:text-sm font-semibold">
          Issue Category <span className="text-destructive">*</span>
        </Label>
        <Select
          value={category}
          onValueChange={(val) => setCategory(val as BugReportCategory)}
        >
          <SelectTrigger id="category" className="h-11 rounded-xl">
            <SelectValue placeholder="Select Category" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {BUG_CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value} className="py-2.5">
                <div className="flex flex-col text-left">
                  <span className="font-medium text-xs sm:text-sm">{cat.label}</span>
                  <span className="text-[11px] text-muted-foreground font-normal">
                    {cat.description}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Bug Title */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="title" className="text-xs sm:text-sm font-semibold">
            Short Summary <span className="text-destructive">*</span>
          </Label>
          <span className="text-[11px] text-muted-foreground">
            {title.length}/120
          </span>
        </div>
        <Input
          id="title"
          placeholder="e.g. Can't select UPI payment on checkout page"
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="h-11 rounded-xl"
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="description" className="text-xs sm:text-sm font-semibold">
            What went wrong? <span className="text-destructive">*</span>
          </Label>
          <span className="text-[11px] text-muted-foreground">
            {description.length}/3000
          </span>
        </div>
        <Textarea
          id="description"
          placeholder="Please describe what you were trying to do, what happened, and any error message you saw..."
          rows={4}
          value={description}
          maxLength={3000}
          onChange={(e) => setDescription(e.target.value)}
          required
          className="rounded-xl resize-none text-xs sm:text-sm"
        />
      </div>

      {/* Screenshot Attachment */}
      <div className="space-y-2">
        <Label className="text-xs sm:text-sm font-semibold flex items-center justify-between">
          <span>Screenshot (Optional)</span>
          <span className="text-[11px] text-muted-foreground font-normal">
            Max 5MB (JPG, PNG, WEBP)
          </span>
        </Label>

        {previewUrl ? (
          <div className="relative rounded-2xl border border-border/80 overflow-hidden bg-muted/30 p-2 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Screenshot preview"
              className="w-16 h-16 object-cover rounded-xl border border-border/50 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">
                {file?.name}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {file ? (file.size / 1024).toFixed(0) : 0} KB
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={removeFile}
              className="rounded-xl text-muted-foreground hover:text-destructive h-8 w-8 mr-1"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border/70 hover:border-primary/50 transition-colors rounded-2xl p-4 sm:p-6 text-center cursor-pointer bg-muted/10 hover:bg-muted/25"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
            <UploadCloud className="w-7 h-7 mx-auto text-muted-foreground/60 mb-2" />
            <p className="text-xs font-medium text-foreground">
              Click to attach a screenshot
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Helps us pinpoint and fix the bug faster
            </p>
          </div>
        )}

        {fileError && (
          <p className="text-[11px] text-destructive font-medium">{fileError}</p>
        )}
      </div>

      {/* Auto-Captured Diagnostics Accordion / Preview */}
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 space-y-2 text-xs">
        <div className="flex items-center justify-between text-muted-foreground">
          <div className="flex items-center gap-1.5 font-medium">
            <Globe className="w-3.5 h-3.5 text-primary" />
            <span>Captured Context</span>
          </div>
          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
            Auto-captured
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-muted-foreground">
          <div className="truncate">
            <span className="font-semibold text-foreground">Page: </span>
            <span className="font-mono">{pageUrl || 'Detecting...'}</span>
          </div>
          <div>
            <span className="font-semibold text-foreground">Device: </span>
            <span>
              {String(deviceInfo.platform || 'Browser')} ({String(deviceInfo.viewport || 'Auto')})
            </span>
          </div>
        </div>
      </div>

      {/* Optional Contact Details */}
      <div className="pt-2 border-t border-border/40 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">
            Contact Details (Optional)
          </span>
          <span className="text-[11px] text-muted-foreground">
            {initialUser ? 'Using your account info' : 'For follow-up questions'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="reporterName" className="text-[11px] text-muted-foreground">
              Your Name
            </Label>
            <Input
              id="reporterName"
              placeholder="e.g. John Doe"
              value={reporterName}
              onChange={(e) => setReporterName(e.target.value)}
              className="h-10 rounded-xl text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="reporterEmail" className="text-[11px] text-muted-foreground">
              Your Email
            </Label>
            <Input
              id="reporterEmail"
              type="email"
              placeholder="e.g. john@example.com"
              value={reporterEmail}
              onChange={(e) => setReporterEmail(e.target.value)}
              className="h-10 rounded-xl text-xs"
            />
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="pt-2">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-12 rounded-xl text-sm font-semibold shadow-md gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Submitting Bug Report...
            </>
          ) : (
            <>
              <Bug className="w-4 h-4" />
              Submit Bug Report
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
