import { Badge } from "@/components/ui/badge";
import { toneFor } from "@/lib/labels";
import { cn } from "@/lib/utils";

const tones = {
  positive: "bg-secondary text-secondary-foreground border-primary/20",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
  negative: "bg-red-50 text-red-700 border-red-200",
  neutral: "bg-muted text-muted-foreground border-border",
} as const;

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label: string;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full px-2.5 py-0.5",
        tones[toneFor(status)],
        className,
      )}
    >
      {label}
    </Badge>
  );
}
