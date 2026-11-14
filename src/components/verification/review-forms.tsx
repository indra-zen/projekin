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
import { Textarea } from "@/components/ui/textarea";
import { reviewVerificationAction } from "@/server/actions/verification";

export function ReviewForms({
  verificationId,
  defaultValidUntil,
  minDate,
  maxDate,
}: {
  verificationId: string;
  defaultValidUntil: string;
  minDate: string;
  maxDate: string;
}) {
  const [state, action] = useActionState(reviewVerificationAction, null);

  if (state?.ok) return <FormAlert state={state} />;

  return (
    <div className="space-y-6">
      <FormAlert state={state} />
      <div className="grid gap-x-6 gap-y-8 lg:grid-cols-2">
        <form
          action={action}
          className="bg-card border-border shadow-ledge space-y-4 rounded-2xl border-2 p-5 [--ledge:var(--success)]"
          noValidate
        >
          <h3 className="font-bold">Setujui</h3>
          <input type="hidden" name="decision" value="approve" />
          <input type="hidden" name="verificationId" value={verificationId} />
          <Field
            label="Berlaku hingga"
            htmlFor="validUntil"
            error={fieldError(state, "validUntil")}
            hint="Bawaan 12 bulan. Maksimal 24 bulan, atau sampai perkiraan kelulusan."
          >
            <Input
              id="validUntil"
              name="validUntil"
              type="date"
              required
              min={minDate}
              max={maxDate}
              defaultValue={fieldValue(state, "validUntil", defaultValidUntil)}
            />
          </Field>
          <SubmitButton className="w-full" pendingLabel="Menyetujui…">
            Setujui verifikasi
          </SubmitButton>
        </form>

        <form
          action={action}
          className="bg-card border-border shadow-ledge space-y-4 rounded-2xl border-2 p-5 [--ledge:var(--accent)]"
          noValidate
        >
          <h3 className="font-bold">Tolak</h3>
          <input type="hidden" name="decision" value="reject" />
          <input type="hidden" name="verificationId" value={verificationId} />
          <Field
            label="Alasan penolakan"
            htmlFor="reason"
            error={fieldError(state, "reason")}
            hint="Ditampilkan kepada pengguna."
          >
            <Textarea
              id="reason"
              name="reason"
              rows={4}
              maxLength={500}
              required
              placeholder="contoh: Foto KTM buram, nama tidak terbaca."
              defaultValue={fieldValue(state, "reason")}
            />
          </Field>
          <SubmitButton
            className="w-full"
            variant="outline"
            pendingLabel="Menolak…"
          >
            Tolak pengajuan
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
