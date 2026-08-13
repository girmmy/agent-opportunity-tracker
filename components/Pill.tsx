import { cn } from '@/lib/utils';

/**
 * Tinted capsule, the way iOS renders semantic state — a wash of the meaning
 * color rather than a saturated fill, so a row of them doesn't shout.
 */
export function Pill({
  label,
  color,
  className,
  dot = true,
}: {
  label: string;
  color: string;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-medium tracking-[-0.005em]',
        className
      )}
      style={{
        color,
        background: `color-mix(in srgb, ${color} 13%, transparent)`,
      }}
    >
      {dot && (
        <span
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-full"
          style={{ background: color }}
        />
      )}
      {label}
    </span>
  );
}
