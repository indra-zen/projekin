"use client";

import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  cancelOrderAction,
  completeOrderAction,
  createOrderReviewAction,
  createServiceOrderAction,
  deliverOrderAction,
  openOrderDisputeAction,
  requestOrderRevisionAction,
  sendOrderMessageAction,
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

/** FR-ORD-04: the freelancer submits the work and optional attachments. */
export function DeliverOrderForm({ orderId }: { orderId: string }) {
  const [state, action] = useActionState(deliverOrderAction, null);
  const [paths, setPaths] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  if (state?.ok) return <FormAlert state={state} />;
  const err = fieldError(state, "message");
  return (
    <form action={action} className="space-y-3" noValidate>
      <FormAlert state={state} />
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="attachmentPaths" value={JSON.stringify(paths)} />
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
      <div className="space-y-2">
        <label htmlFor={`files-${orderId}`} className="text-sm font-medium">
          Lampiran (opsional)
        </label>
        <Input
          id={`files-${orderId}`}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,application/pdf,application/zip,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          disabled={uploading || paths.length >= 10}
          onChange={async (event) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length === 0) return;
            if (paths.length + files.length > 10) {
              setUploadError("Maksimal 10 lampiran per pengiriman.");
              return;
            }
            setUploading(true);
            setUploadError(null);
            const supabase = createClient();
            const { data } = await supabase.auth.getUser();
            if (!data.user) {
              setUploadError("Sesi Anda berakhir. Silakan masuk kembali.");
              setUploading(false);
              return;
            }
            const uploaded: string[] = [];
            for (const file of files) {
              if (file.size > 25 * 1024 * 1024) {
                setUploadError("Ukuran setiap lampiran maksimal 25 MB.");
                break;
              }
              const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
              const path = `${orderId}/${data.user.id}/${crypto.randomUUID()}-${safeName}`;
              const result = await supabase.storage
                .from("order-files")
                .upload(path, file, { upsert: false });
              if (result.error) {
                setUploadError("Lampiran gagal diunggah. Coba lagi.");
                break;
              }
              uploaded.push(path);
            }
            setPaths((current) => [...current, ...uploaded]);
            setUploading(false);
            event.target.value = "";
          }}
        />
        {uploading ? (
          <p className="text-muted-foreground text-xs">Mengunggah lampiran…</p>
        ) : null}
        {paths.length > 0 ? (
          <ul className="text-muted-foreground space-y-1 text-xs">
            {paths.map((path) => (
              <li key={path} className="truncate">
                {path.split("/").at(-1)}
              </li>
            ))}
          </ul>
        ) : null}
        {uploadError ? <p className="text-destructive text-xs">{uploadError}</p> : null}
      </div>
      <SubmitButton pendingLabel="Mengirim…">Kirim hasil kerja</SubmitButton>
    </form>
  );
}

export function OrderMessageForm({ orderId }: { orderId: string }) {
  const [state, action] = useActionState(sendOrderMessageAction, null);
  return (
    <form action={action} className="space-y-3" noValidate>
      <FormAlert state={state} />
      <input type="hidden" name="orderId" value={orderId} />
      <Field
        label="Kirim pesan"
        htmlFor={`message-${orderId}`}
        error={fieldError(state, "body")}
      >
        <Textarea
          id={`message-${orderId}`}
          name="body"
          rows={3}
          maxLength={5000}
          defaultValue={fieldValue(state, "body")}
          placeholder="Tulis pesan untuk pihak lain…"
        />
      </Field>
      <SubmitButton variant="outline" pendingLabel="Mengirim…">
        Kirim pesan
      </SubmitButton>
    </form>
  );
}

export function DeliveryAttachments({ paths }: { paths: string[] }) {
  const [urls, setUrls] = useState<{ name: string; url: string }[]>([]);
  useEffect(() => {
    let active = true;
    void Promise.all(
      paths.map(async (path) => {
        const { data } = await createClient()
          .storage.from("order-files")
          .createSignedUrl(path, 60 * 60);
        return data?.signedUrl
          ? { name: path.split("/").at(-1) ?? "Lampiran", url: data.signedUrl }
          : null;
      }),
    ).then((items) => {
      if (active) setUrls(items.filter((item): item is NonNullable<typeof item> => item !== null));
    });
    return () => {
      active = false;
    };
  }, [paths]);
  if (urls.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1 text-sm">
      {urls.map((item) => (
        <li key={item.url}>
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
          >
            Unduh {item.name}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function RevisionRequestForm({ orderId }: { orderId: string }) {
  const [state, action] = useActionState(requestOrderRevisionAction, null);
  return (
    <details open={state ? true : undefined}>
      <summary className={summaryClass("outline")}>Minta revisi</summary>
      <form action={action} className="mt-3 space-y-3" noValidate>
        <FormAlert state={state} />
        <input type="hidden" name="orderId" value={orderId} />
        <Field
          label="Detail revisi"
          htmlFor={`revision-${orderId}`}
          error={fieldError(state, "reason")}
          hint="Sisa revisi akan berkurang setelah permintaan dikirim."
        >
          <Textarea
            id={`revision-${orderId}`}
            name="reason"
            rows={4}
            maxLength={2000}
            defaultValue={fieldValue(state, "reason")}
          />
        </Field>
        <SubmitButton variant="outline" pendingLabel="Mengirim…">
          Kirim permintaan revisi
        </SubmitButton>
      </form>
    </details>
  );
}

export function DisputeForm({ orderId }: { orderId: string }) {
  const [state, action] = useActionState(openOrderDisputeAction, null);
  return (
    <details open={state ? true : undefined}>
      <summary className={summaryClass("outline")}>Buka sengketa</summary>
      <form action={action} className="mt-3 space-y-3" noValidate>
        <FormAlert state={state} />
        <input type="hidden" name="orderId" value={orderId} />
        <Field
          label="Alasan sengketa"
          htmlFor={`dispute-${orderId}`}
          error={fieldError(state, "reason")}
        >
          <Textarea
            id={`dispute-${orderId}`}
            name="reason"
            rows={4}
            maxLength={2000}
            defaultValue={fieldValue(state, "reason")}
          />
        </Field>
        <SubmitButton variant="outline" pendingLabel="Membuka…">
          Ya, buka sengketa
        </SubmitButton>
      </form>
    </details>
  );
}

export function OrderReviewForm({ orderId }: { orderId: string }) {
  const [state, action] = useActionState(createOrderReviewAction, null);
  return (
    <form action={action} className="space-y-3" noValidate>
      <FormAlert state={state} />
      <input type="hidden" name="orderId" value={orderId} />
      <Field
        label="Rating"
        htmlFor={`rating-${orderId}`}
        error={fieldError(state, "rating")}
      >
        <select
          id={`rating-${orderId}`}
          name="rating"
          defaultValue={fieldValue(state, "rating") ?? "5"}
          className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
        >
          {[5, 4, 3, 2, 1].map((rating) => (
            <option key={rating} value={rating}>
              {rating} / 5
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="Ulasan (opsional)"
        htmlFor={`review-${orderId}`}
        error={fieldError(state, "comment")}
      >
        <Textarea
          id={`review-${orderId}`}
          name="comment"
          rows={3}
          maxLength={2000}
          defaultValue={fieldValue(state, "comment")}
        />
      </Field>
      <SubmitButton pendingLabel="Menyimpan…">Kirim ulasan</SubmitButton>
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
