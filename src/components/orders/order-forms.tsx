"use client";

import { useActionState } from "react";
import {
  Field,
  FormAlert,
  SubmitButton,
  fieldError,
  fieldValue,
} from "@/components/forms/form-primitives";
import { buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  cancelOrderAction,
  completeOrderAction,
  createServiceOrderAction,
  deliverOrderAction,
} from "@/server/actions/orders";

const summaryClass = (variant: "default" | "outline") =>
  cn(
    buttonVariants({ variant, size: "sm" }),
    "cursor-pointer list-none [&::-webkit-details-marker]:hidden",
  );

/** FR-ORD-01: requirements for a service order, then on to payment. */
export function ServiceOrderForm({
  serviceId,
  prompt,
}: {
  serviceId: string;
  prompt: string | null;
}) {
  const [state, action] = useActionState(createServiceOrderAction, null);
  const err = fieldError(state, "requirements");
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormAlert state={state} />
      <input type="hidden" name="serviceId" value={serviceId} />
      <Field
        label="Kebutuhan Anda"
        htmlFor="requirements"
        error={err}
        hint={
          prompt
            ? `Petunjuk dari freelancer: ${prompt}`
            : "Jelaskan apa yang Anda butuhkan (10–5.000 karakter)."
        }
      >
        <Textarea
          id="requirements"
          name="requirements"
          rows={7}
          maxLength={5000}
          defaultValue={fieldValue(state, "requirements")}
          aria-invalid={Boolean(err)}
        />
      </Field>
      <SubmitButton pendingLabel="Membuat pesanan…" className="w-full">
        Buat pesanan &amp; lanjut ke pembayaran
      </SubmitButton>
    </form>
  );
}

/**
 * BR-20 cancellation. `<details>` keeps the confirmation step working even
 * when page JavaScript does not run.
 */
export function CancelOrderForm({
  orderId,
  refundNotice = false,
}: {
  orderId: string;
  refundNotice?: boolean;
}) {
  const [state, action] = useActionState(cancelOrderAction, null);
  if (state?.ok) return <FormAlert state={state} />;
  return (
    <details className="group" open={state ? true : undefined}>
      <summary className={summaryClass("outline")}>Batalkan pesanan</summary>
      <form
        action={action}
        className="bg-card mt-3 space-y-3 rounded-2xl border p-4"
        noValidate
      >
        <FormAlert state={state} />
        <input type="hidden" name="orderId" value={orderId} />
        {refundNotice ? (
          <p className="text-muted-foreground text-sm">
            Pesanan sudah dibayar. Pembatalan sebelum pengiriman pertama membuat
            dana klien dikembalikan penuh (diproses admin).
          </p>
        ) : null}
        <Field
          label="Alasan pembatalan"
          htmlFor={`cancel-reason-${orderId}`}
          error={fieldError(state, "reason")}
        >
          <Textarea
            id={`cancel-reason-${orderId}`}
            name="reason"
            rows={2}
            maxLength={500}
            defaultValue={fieldValue(state, "reason")}
          />
        </Field>
        <SubmitButton variant="outline" pendingLabel="Membatalkan…">
          Ya, batalkan pesanan
        </SubmitButton>
      </form>
    </details>
  );
}

/** FR-ORD-04: the freelancer submits the work (message; files in Phase 7). */
export function DeliverOrderForm({ orderId }: { orderId: string }) {
  const [state, action] = useActionState(deliverOrderAction, null);
  if (state?.ok) return <FormAlert state={state} />;
  const err = fieldError(state, "message");
  return (
    <form action={action} className="space-y-3" noValidate>
      <FormAlert state={state} />
      <input type="hidden" name="orderId" value={orderId} />
      <Field
        label="Kirim hasil kerja"
        htmlFor={`deliver-${orderId}`}
        error={err}
        hint="Jelaskan hasil kerja dan sertakan tautan unduhan bila ada (maksimal 5.000 karakter)."
      >
        <Textarea
          id={`deliver-${orderId}`}
          name="message"
          rows={5}
          maxLength={5000}
          defaultValue={fieldValue(state, "message")}
          aria-invalid={Boolean(err)}
        />
      </Field>
      <SubmitButton pendingLabel="Mengirim…">Kirim hasil kerja</SubmitButton>
    </form>
  );
}

/** FR-ORD-05: the client confirms the work is done (BR-23 payout pending). */
export function CompleteOrderForm({ orderId }: { orderId: string }) {
  const [state, action] = useActionState(completeOrderAction, null);
  if (state?.ok) return <FormAlert state={state} />;
  return (
    <details open={state ? true : undefined}>
      <summary className={summaryClass("default")}>
        Konfirmasi pesanan selesai
      </summary>
      <form
        action={action}
        className="bg-card mt-3 space-y-3 rounded-2xl border p-4"
      >
        <FormAlert state={state} />
        <input type="hidden" name="orderId" value={orderId} />
        <p className="text-sm">
          Pastikan hasil kerja sudah sesuai. Setelah dikonfirmasi, pesanan
          selesai dan pembayaran untuk freelancer diproses oleh admin.
        </p>
        <SubmitButton pendingLabel="Menyelesaikan…">
          Ya, pesanan selesai
        </SubmitButton>
      </form>
    </details>
  );
}
