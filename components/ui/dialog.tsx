'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogTitle = DialogPrimitive.Title;

/**
 * Bottom sheet on phones, centered card on larger screens — the iOS pattern.
 * A centered modal on a small screen puts controls under the thumb-unfriendly
 * middle of the display and leaves no room for the keyboard.
 */
export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    title: string;
  }
>(({ className, children, title, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/25 backdrop-blur-[2px] data-[state=open]:animate-overlay-in" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-[var(--radius-apple-xl)] bg-[var(--surface)] p-5 shadow-[var(--shadow-lg)] outline-none',
        'data-[state=open]:animate-sheet-in',
        'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-[560px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[var(--radius-apple-xl)] sm:data-[state=open]:animate-content-in',
        className
      )}
      {...props}
    >
      {/* Grab handle reads as "drag to dismiss" on touch; hidden on desktop. */}
      <div
        aria-hidden="true"
        className="mx-auto mb-3 h-1 w-9 rounded-full bg-[var(--separator-opaque)] sm:hidden"
      />
      <div className="mb-4 flex items-center justify-between gap-3">
        <DialogPrimitive.Title className="text-[17px] font-semibold tracking-[-0.019em]">
          {title}
        </DialogPrimitive.Title>
        <DialogPrimitive.Close className="grid size-7 place-items-center rounded-full bg-[var(--surface-sunken)] text-[var(--label-2)] transition-colors hover:text-[var(--label)]">
          <X className="size-4" strokeWidth={2.5} />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </div>
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = 'DialogContent';
