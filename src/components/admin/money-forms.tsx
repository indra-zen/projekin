"use client";

import { useActionState } from "react";
import {
  Field,
  FormAlert,
  SubmitButton,
  fieldError,
  fieldValue,
} from "@/components/forms/form-primitives";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  markPayoutPaidAction,
  markRefundCompletedAction,
  resolveDisputeAction,
} from "@/server/actions/admin-money";

/** FR-ADM-04: release to the freelancer or refund the client, with a note. */
export function ResolveDisputeForm({
  disputeId,
  orderId,
}: {
  disputeId: string;
  orderId: string;
}) {
  const [state, action] = useActionState(resolveDisputeAction, null);
  if (state?.ok) return <FormAlert state={state} />;
  return (
    <form action={action} className="space-y-3" noValidate>
      <FormAlert state={state} />
      <input type="hidden" name="disputeId" value={disputeId} />
      <input type="hidden" name="orderId" value={orderId} />
      <Field
        label="Keputusan"
        htmlFor={`resolution-${disputeId}`}
        error={fieldError(state, "resolution")}
      >
        <NativeSelect
          id={`resolution-${disputeId}`}
          name="resolution"
          defaultValue={fieldValue(state, "resolution") || ""}
        >
          <option value="" disabled>
            Pilih keputusan…
          </option>
          <option value="release_to_freelancer">
            Teruskan dana ke freelancer (pesanan selesai)
          </option>
          <option value="refund_client">
            Kembalikan dana ke klien (pesanan dibatalkan)
          </option>
        </NativeSelect>
      </Field>
      <Field
        label="Catatan admin"
        htmlFor={`note-${disputeId}`}
        error={fieldError(state, "adminNote")}
        hint="Terlihat oleh klien dan freelancer."
      >
        <Textarea
          id={`note-${disputeId}`}
          name="adminNote"
          rows={3}
          maxLength={2000}
          defaultValue={fieldValue(state, "adminNote")}
        />
      </Field>
      <SubmitButton pendingLabel="Menyimpan…">Putuskan sengketa</SubmitButton>
    </form>
  );
}

function ReferenceForm({
  id,
  label,
  hidden,
  action: serverAction,
  submitLabel,
}: {
  id: string;
  label: string;
  hidden: Record<string, string>;
  action: typeof markRefundCompletedAction;
  submitLabel: string;
}) {
  const [state, action] = useActionState(serverAction, null);
  if (state?.ok) return <FormAlert state={state} />;
  return (
    <form action={action} className="space-y-2" noValidate>
      <FormAlert state={state} />
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Field
          label={label}
          htmlFor={`ref-${id}`}
          error={fieldError(state, "reference")}
          className="min-w-0 flex-1"
        >
          <Input
            id={`ref-${id}`}
            name="reference"
            maxLength={200}
            defaultValue={fieldValue(state, "reference")}
            placeholder="Contoh: Transfer BCA 14/11 #123"
          />
        </Field>
        <SubmitButton pendingLabel="Menyimpan…">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}

/** FR-ADM-05 / BR-24: after refunding in the Midtrans dashboard or off-platform. */
export function MarkRefundForm({
  paymentId,
  orderId,
}: {
  paymentId: string;
  orderId: string;
}) {
  return (
    <ReferenceForm
      id={paymentId}
      label="Referensi pengembalian dana"
      hidden={{ paymentId, orderId }}
      action={markRefundCompletedAction}
      submitLabel="Tandai sudah dikembalikan"
    />
  );
}

/** FR-ADM-05 / BR-23: after transferring the earnings off-platform. */
export function MarkPayoutForm({ orderId }: { orderId: string }) {
  return (
    <ReferenceForm
      id={orderId}
      label="Referensi transfer"
      hidden={{ orderId }}
      action={markPayoutPaidAction}
      submitLabel="Tandai sudah dibayar"
    />
  );
}
