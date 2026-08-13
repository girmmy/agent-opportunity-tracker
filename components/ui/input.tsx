'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * text-base on small screens is deliberate: iOS Safari zooms the viewport when
 * a focused input renders below 16px. Drops to 14px once there's room.
 */
export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'flex h-10 w-full rounded-[10px] bg-[var(--surface-sunken)] px-3 text-base tracking-[-0.01em] text-[var(--label)] transition-shadow duration-150 sm:text-[14px]',
      'placeholder:text-[var(--label-3)]',
      'border border-transparent focus:border-[color-mix(in_srgb,var(--accent)_50%,transparent)] focus:bg-[var(--surface)] focus:outline-none focus:ring-4 focus:ring-[color-mix(in_srgb,var(--accent)_14%,transparent)]',
      'disabled:opacity-50',
      className
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-[76px] w-full resize-y rounded-[10px] bg-[var(--surface-sunken)] px-3 py-2.5 text-base leading-relaxed tracking-[-0.01em] text-[var(--label)] transition-shadow duration-150 sm:text-[14px]',
      'placeholder:text-[var(--label-3)]',
      'border border-transparent focus:border-[color-mix(in_srgb,var(--accent)_50%,transparent)] focus:bg-[var(--surface)] focus:outline-none focus:ring-4 focus:ring-[color-mix(in_srgb,var(--accent)_14%,transparent)]',
      className
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        'text-[12px] font-medium tracking-[-0.005em] text-[var(--label-2)]',
        className
      )}
      {...props}
    />
  );
}
