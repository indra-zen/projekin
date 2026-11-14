"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { withdrawProposalAction } from "@/server/actions/jobs";

export function WithdrawProposalButton({ proposalId }: { proposalId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setConfirming(true)}
      >
        Tarik proposal
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm">
        Tarik proposal ini? Anda tidak dapat mengirim ulang.
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await withdrawProposalAction({ proposalId });
            if (!result.ok) setError(result.error.message);
          })
        }
      >
        Ya, tarik
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => setConfirming(false)}
      >
        Batal
      </Button>
      {error ? (
        <p className="text-destructive w-full text-xs">{error}</p>
      ) : null}
    </div>
  );
}
