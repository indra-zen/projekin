"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  setServiceStatusAction,
  deleteServiceAction,
} from "@/server/actions/services";
export function ServiceActions({ id, status }: { id: string; status: string }) {
  const [busy, setBusy] = useState(false);
  async function run(next: "published" | "paused" | "archived") {
    setBusy(true);
    const result = await setServiceStatusAction({ id, status: next });
    setBusy(false);
    if (!result.ok) window.alert(result.error.message);
  }
  async function remove() {
    if (!window.confirm("Hapus draf layanan ini?")) return;
    setBusy(true);
    const result = await deleteServiceAction({ id });
    setBusy(false);
    if (!result.ok) window.alert(result.error.message);
    else window.location.reload();
  }
  return (
    <div className="flex flex-wrap gap-2">
      {status === "draft" ? (
        <>
          <Button
            size="sm"
            onClick={() => void run("published")}
            disabled={busy}
          >
            Publikasikan
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void remove()}
            disabled={busy}
          >
            Hapus
          </Button>
        </>
      ) : null}
      {status === "published" ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => void run("paused")}
          disabled={busy}
        >
          Jedaikan
        </Button>
      ) : null}
      {status === "paused" ? (
        <Button size="sm" onClick={() => void run("published")} disabled={busy}>
          Publikasikan lagi
        </Button>
      ) : null}
      {status !== "archived" ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void run("archived")}
          disabled={busy}
        >
          Arsipkan
        </Button>
      ) : null}
    </div>
  );
}
