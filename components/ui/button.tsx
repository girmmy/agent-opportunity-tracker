'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // Apple buttons: pill-ish radius, tight tracking, and a subtle press-scale
  // rather than a color flash.
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] text-[14px] font-medium tracking-[-0.01em] transition-all duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--accent)] text-[var(--accent-fg)] shadow-[var(--shadow-sm)] hover:brightness-110',
        secondary:
          'bg-[var(--surface-sunken)] text-[var(--label)] hover:brightness-[0.97] dark:hover:brightness-125',
        ghost:
          'text-[var(--label-2)] hover:bg-[var(--surface-sunken)] hover:text-[var(--label)]',
        tinted:
          'bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_18%,transparent)]',
        destructive:
          'bg-[color-mix(in_srgb,var(--red)_12%,transparent)] text-[var(--red)] hover:bg-[color-mix(in_srgb,var(--red)_18%,transparent)]',
      },
      size: {
        sm: 'h-8 px-3 text-[13px]',
        md: 'h-9 px-4',
        lg: 'h-11 px-5 text-[15px]',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { buttonVariants };
