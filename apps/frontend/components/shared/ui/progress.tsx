import { cn } from "@frontend/lib/utils";
export function Progress({
  value,
  className,
  label = "Progress",
}: {
  value: number;
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={cn("progress", className)}
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
