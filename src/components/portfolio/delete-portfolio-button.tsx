"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { deletePortfolioItemAction } from "@/server/actions/portfolio";
export function DeletePortfolioButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm("Hapus karya ini?")) return;
        setBusy(true);
        const result = await deletePortfolioItemAction({ id });
        setBusy(false);
        if (!result.ok) window.alert(result.error.message);
        else window.location.reload();
      }}
    >
      Hapus
    </Button>
  );
}
