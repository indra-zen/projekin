import { BadgeCheck, Clock, ShieldAlert, ShieldQuestion } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  verificationStateLabels,
  type VerificationState,
} from "@/lib/capabilities";
import { cn } from "@/lib/utils";

const styles: Record<VerificationState, string> = {
  verified: "bg-success text-foreground",
  pending: "bg-highlight text-foreground",
  rejected: "bg-danger-soft text-foreground",
  unverified: "bg-muted text-foreground",
};

const icons = {
  verified: BadgeCheck,
  pending: Clock,
  rejected: ShieldAlert,
  unverified: ShieldQuestion,
} satisfies Record<VerificationState, unknown>;

export function VerificationBadge({
  state,
  className,
}: {
  state: VerificationState;
  className?: string;
}) {
  const Icon = icons[state];
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 px-2.5 py-1", styles[state], className)}
    >
      <Icon className="size-3.5" />
      {verificationStateLabels[state]}
    </Badge>
  );
}

/** Public "Mahasiswa terverifikasi" badge for profiles. */
export function VerifiedStudentBadge({
  university,
}: {
  university?: string | null;
}) {
  return (
    <Badge
      variant="outline"
      className="bg-success text-foreground gap-1.5 px-2.5 py-1"
    >
      <BadgeCheck className="size-3.5" />
      Mahasiswa terverifikasi{university ? ` · ${university}` : ""}
    </Badge>
  );
}
