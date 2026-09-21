'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Star, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { createReview } from '@/lib/customers/actions';

interface ReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId?: string;
  orderId?: string;
  orderNumber?: string;
  branchId: string;
  branchName: string;
  customerName?: string;
  onSuccess?: () => void;
}

export function ReviewDialog({
  open,
  onOpenChange,
  customerId,
  orderId,
  orderNumber,
  branchId,
  branchName,
  customerName,
  onSuccess,
}: ReviewDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (rating < 1 || rating > 5) {
      toast.error('Rating must be between 1 and 5 stars');
      return;
    }

    startTransition(async () => {
      try {
        const res = await createReview({
          customerId: customerId || undefined,
          orderId: orderId || undefined,
          branchId,
          rating,
          title: title.trim() || undefined,
          comment: comment.trim() || undefined,
        });

        if (res.success) {
          toast.success('Customer review submitted successfully');
          setTitle('');
          setComment('');
          setRating(5);
          onOpenChange(false);
          router.refresh();
          onSuccess?.();
        } else {
          toast.error(res.error || 'Failed to submit review');
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unexpected error occurred';
        toast.error(message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="size-5 fill-amber-400 text-amber-500" />
              Submit Customer Review
            </DialogTitle>
            <DialogDescription>
              Record customer dining experience and ratings. Rating-only reviews without commentary are fully supported.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Context bar */}
            <div className="rounded-lg bg-muted/60 p-3 text-xs flex flex-wrap gap-4">
              <div>
                <span className="text-muted-foreground">Branch: </span>
                <span className="font-semibold">{branchName}</span>
              </div>
              {customerName && (
                <div>
                  <span className="text-muted-foreground">Customer: </span>
                  <span className="font-semibold">{customerName}</span>
                </div>
              )}
              {orderNumber && (
                <div>
                  <span className="text-muted-foreground">Order: </span>
                  <span className="font-semibold">{orderNumber}</span>
                </div>
              )}
            </div>

            {/* Interactive Star Rating */}
            <div className="flex flex-col items-center justify-center gap-2 py-2">
              <Label className="text-xs font-semibold text-muted-foreground">
                Overall Experience Rating (1–5)
              </Label>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = (hoverRating ?? rating) >= star;
                  return (
                    <button
                      key={star}
                      type="button"
                      disabled={isPending}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(null)}
                      onClick={() => setRating(star)}
                      className="p-1 transition-transform hover:scale-110 focus:outline-none"
                    >
                      <Star
                        className={`size-8 transition-colors ${
                          active
                            ? 'fill-amber-400 text-amber-500'
                            : 'text-muted-foreground/30'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                {rating === 5
                  ? '⭐⭐⭐⭐⭐ Excellent'
                  : rating === 4
                  ? '⭐⭐⭐⭐ Good'
                  : rating === 3
                  ? '⭐⭐⭐ Average'
                  : rating === 2
                  ? '⭐⭐ Poor'
                  : '⭐ Terrible'}
              </span>
            </div>

            {/* Review Title */}
            <div className="grid gap-2">
              <Label htmlFor="rev-title" className="text-xs font-semibold">
                Summary / Headline (Optional)
              </Label>
              <Input
                id="rev-title"
                placeholder="e.g. Delicious sourdough & warm service"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isPending}
              />
            </div>

            {/* Review Comment */}
            <div className="grid gap-2">
              <Label htmlFor="rev-comment" className="text-xs font-semibold">
                Feedback Comment (Optional)
              </Label>
              <Textarea
                id="rev-comment"
                placeholder="Leave detailed customer feedback here. Blank comments are allowed if customer provided rating only."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                disabled={isPending}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="gap-1.5">
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Submit Review
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
