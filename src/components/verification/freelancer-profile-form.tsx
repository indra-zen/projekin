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
import { updateFreelancerProfileAction } from "@/server/actions/verification";

export function FreelancerProfileForm({
  defaults,
}: {
  defaults: { headline: string; major: string; skills: string };
}) {
  const [state, action] = useActionState(updateFreelancerProfileAction, null);
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormAlert state={state} />
      <Field
        label="Headline"
        htmlFor="headline"
        error={fieldError(state, "headline")}
        hint="Contoh: Desainer logo & identitas visual."
      >
        <Input
          id="headline"
          name="headline"
          maxLength={120}
          defaultValue={fieldValue(state, "headline", defaults.headline)}
          aria-invalid={Boolean(fieldError(state, "headline"))}
        />
      </Field>
      <Field
        label="Program studi"
        htmlFor="major"
        error={fieldError(state, "major")}
      >
        <Input
          id="major"
          name="major"
          maxLength={100}
          defaultValue={fieldValue(state, "major", defaults.major)}
          aria-invalid={Boolean(fieldError(state, "major"))}
        />
      </Field>
      <Field
        label="Keahlian"
        htmlFor="skills"
        error={fieldError(state, "skills")}
        hint="Pisahkan dengan koma. Maksimal 15 keahlian, masing-masing maksimal 30 karakter."
      >
        <Input
          id="skills"
          name="skills"
          placeholder="Figma, Ilustrasi, Branding"
          defaultValue={fieldValue(state, "skills", defaults.skills)}
          aria-invalid={Boolean(fieldError(state, "skills"))}
        />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Menyimpan…">
          Simpan profil freelancer
        </SubmitButton>
      </div>
    </form>
  );
}
