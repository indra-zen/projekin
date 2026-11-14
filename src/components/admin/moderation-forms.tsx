"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { FormAlert, SubmitButton } from "@/components/forms/form-primitives";
import { moderationFormAction } from "@/server/actions/moderation";

export function FreelancerModerationForm({
  userId,
  suspended,
}: {
  userId: string;
  suspended: boolean;
}) {
  const [state, action] = useActionState(moderationFormAction, null);
  return (
    <form action={action} className="space-y-2">
      <FormAlert state={state} />
      <input type="hidden" name="kind" value="freelancer" />
      <input type="hidden" name="userId" value={userId} />
      <input
        type="hidden"
        name="status"
        value={suspended ? "active" : "suspended"}
      />
      <SubmitButton variant={suspended ? "default" : "outline"}>
        {suspended ? "Aktifkan kembali" : "Tangguhkan"}
      </SubmitButton>
    </form>
  );
}

export function ServiceModerationForm({
  serviceId,
  blocked,
}: {
  serviceId: string;
  blocked: boolean;
}) {
  const [state, action] = useActionState(moderationFormAction, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <FormAlert state={state} />
      <input type="hidden" name="kind" value="service" />
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="blocked" value={String(!blocked)} />
      {!blocked ? (
        <Input
          name="reason"
          placeholder="Alasan blokir"
          required
          maxLength={500}
        />
      ) : null}
      <SubmitButton variant={blocked ? "default" : "outline"}>
        {blocked ? "Batalkan blokir" : "Blokir layanan"}
      </SubmitButton>
    </form>
  );
}
