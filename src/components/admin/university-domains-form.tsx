"use client";

import { useActionState } from "react";
import {
  Field,
  FormAlert,
  SubmitButton,
  fieldError,
  fieldValue,
} from "@/components/forms/form-primitives";
import { Textarea } from "@/components/ui/textarea";
import { setUniversityDomainsAction } from "@/server/actions/admin-universities";

export function UniversityDomainsForm({
  universityId,
  domains,
}: {
  universityId: string;
  domains: string[];
}) {
  const [state, action] = useActionState(setUniversityDomainsAction, null);
  const id = `domains-${universityId}`;
  return (
    <form action={action} className="space-y-3" noValidate>
      <FormAlert state={state} />
      <input type="hidden" name="universityId" value={universityId} />
      <Field
        label="Domain email mahasiswa"
        htmlFor={id}
        error={fieldError(state, "domains")}
        hint="Satu domain per baris, bagian setelah @ (contoh: student.ppkia.ac.id). Harus sama persis; kosongkan untuk mematikan verifikasi lewat email."
      >
        <Textarea
          id={id}
          name="domains"
          rows={3}
          spellCheck={false}
          defaultValue={fieldValue(state, "domains", domains.join("\n"))}
        />
      </Field>
      <SubmitButton pendingLabel="Menyimpan…">Simpan domain</SubmitButton>
    </form>
  );
}
