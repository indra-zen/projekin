"use client";

import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  startPaymentAction,
  syncPaymentStatusAction,
  type PaymentSyncData,
} from "@/server/actions/payments";

type SnapCallback = (result?: unknown) => void;
type SnapApi = {
  pay: (
    token: string,
    callbacks?: {
      onSuccess?: SnapCallback;
      onPending?: SnapCallback;
      onError?: SnapCallback;
      onClose?: () => void;
    },
  ) => void;
};

declare global {
  interface Window {
    snap?: SnapApi;
  }
}

// Sandbox only (ARCHITECTURE §4.1).
const SNAP_JS_URL = "https://app.sandbox.midtrans.com/snap/snap.js";

let snapLoader: Promise<SnapApi> | null = null;

function loadSnap(clientKey: string): Promise<SnapApi> {
  if (window.snap) return Promise.resolve(window.snap);
  snapLoader ??= new Promise<SnapApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SNAP_JS_URL;
    script.async = true;
    script.setAttribute("data-client-key", clientKey);
    script.onload = () =>
      window.snap ? resolve(window.snap) : reject(new Error("snap missing"));
    script.onerror = () => {
      snapLoader = null;
      script.remove();
      reject(new Error("snap.js failed to load"));
    };
    document.head.appendChild(script);
  });
  return snapLoader;
}

function describe(data: PaymentSyncData): string | null {
  if (data.orderStatus === "in_progress")
    return "Pembayaran terkonfirmasi. Freelancer mulai mengerjakan pesanan Anda.";
  if (data.orderStatus !== "awaiting_payment") return null;
  switch (data.paymentStatus) {
    case "pending":
      return "Menunggu pembayaran Anda. Selesaikan sesuai instruksi (mis. transfer ke Virtual Account atau pindai QRIS); status diperbarui setelah Midtrans mengonfirmasi.";
    case "failed":
    case "expired":
    case "cancelled":
      return "Pembayaran belum berhasil. Anda dapat mencoba lagi.";
    default:
      return null;
  }
}

/**
 * FR-PAY-01/03: pay with Snap and verify the result server-side. The Snap
 * callbacks only trigger a server-side Status API check; they never mark the
 * order paid themselves (FR-PAY-02).
 */
export function PaymentPanel({
  orderId,
  clientKey,
  canPay,
  resume,
  hasAttempt,
  autoSync,
}: {
  orderId: string;
  clientKey: string | null;
  canPay: boolean;
  resume: boolean;
  hasAttempt: boolean;
  autoSync: boolean;
}) {
  const router = useRouter();
  const [starting, startTransition] = useTransition();
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const autoRan = useRef(false);

  const sync = useCallback(async () => {
    if (inFlight.current) return; // at most one sync in flight
    inFlight.current = true;
    setSyncing(true);
    try {
      const result = await syncPaymentStatusAction({ orderId });
      if (result.ok) {
        setError(null);
        setNotice(describe(result.data));
        router.refresh();
      } else {
        setError(result.error.message);
      }
    } finally {
      inFlight.current = false;
      setSyncing(false);
    }
  }, [orderId, router]);

  useEffect(() => {
    if (!autoSync || autoRan.current) return;
    autoRan.current = true;
    const timer = window.setTimeout(() => void sync(), 0);
    return () => window.clearTimeout(timer);
  }, [autoSync, sync]);

  function pay() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await startPaymentAction({ orderId });
      if (!result.ok) {
        setError(result.error.message);
        router.refresh();
        return;
      }
      const { snapToken, redirectUrl } = result.data;
      let snap: SnapApi;
      try {
        if (!clientKey) throw new Error("no client key");
        snap = await loadSnap(clientKey);
      } catch {
        // Fallback: Midtrans' hosted Snap page; it returns to ?payment=finish.
        window.location.assign(redirectUrl);
        return;
      }
      snap.pay(snapToken, {
        onSuccess: () => void sync(),
        onPending: () => void sync(),
        onError: () => void sync(),
        onClose: () => void sync(),
      });
    });
  }

  return (
    <div className="space-y-3">
      {error ? (
        <Alert variant="destructive" className="border-destructive/30">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {notice ? (
        <p className="text-sm font-medium" role="status">
          {notice}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {canPay ? (
          <Button type="button" onClick={pay} disabled={starting}>
            {starting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" /> Menyiapkan
                pembayaran…
              </>
            ) : resume ? (
              "Lanjutkan pembayaran"
            ) : (
              "Bayar sekarang"
            )}
          </Button>
        ) : null}
        {hasAttempt ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => void sync()}
            disabled={syncing}
          >
            {syncing ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            Periksa status pembayaran
          </Button>
        ) : null}
      </div>
      <p className="text-muted-foreground text-xs">
        Metode: QRIS, e-wallet (GoPay, ShopeePay) dan Virtual Account bank,
        melalui Midtrans. Mode Sandbox: tidak ada uang sungguhan yang berpindah.
      </p>
    </div>
  );
}
