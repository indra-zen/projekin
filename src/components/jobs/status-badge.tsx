import { Badge } from "@/components/ui/badge";
import { toneFor } from "@/lib/labels";
import { cn } from "@/lib/utils";

const tones = {
  positive: "bg-success text-foreground",
  warning: "bg-highlight text-foreground",
  negative: "bg-danger-soft text-foreground",
  neutral: "bg-muted text-foreground",
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
      className={cn("px-2.5 py-0.5", tones[toneFor(status)], className)}
    >
      {label}
    </Badge>
  );
}
