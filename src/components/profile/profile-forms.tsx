"use client";

import Link from "next/link";
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
import {
  completeOnboardingAction,
  updateProfileAction,
} from "@/server/actions/profile";

export function OnboardingForm({
  defaultFullName,
}: {
  defaultFullName: string;
}) {
  const [state, action] = useActionState(completeOnboardingAction, null);
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormAlert state={state} />
      <Field
        label="Nama lengkap"
        htmlFor="fullName"
        error={fieldError(state, "fullName")}
      >
        <Input
          id="fullName"
          name="fullName"
          required
          maxLength={100}
          defaultValue={fieldValue(state, "fullName", defaultFullName)}
          aria-invalid={Boolean(fieldError(state, "fullName"))}
          className="h-11"
        />
      </Field>
      <Field
        label="Username"
        htmlFor="username"
        error={fieldError(state, "username")}
        hint="3–30 karakter: huruf kecil, angka, atau garis bawah. Dipakai untuk alamat profil publik Anda."
      >
        <Input
          id="username"
          name="username"
          required
          minLength={3}
          maxLength={30}
          autoCapitalize="none"
          autoComplete="username"
          placeholder="contoh: rina_desain"
          defaultValue={fieldValue(state, "username")}
          aria-invalid={Boolean(fieldError(state, "username"))}
          className="h-11"
        />
      </Field>
      <div className="space-y-2">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="acceptTerms"
            className="accent-primary mt-0.5 size-4"
            defaultChecked={fieldValue(state, "acceptTerms") === "on"}
            aria-invalid={Boolean(fieldError(state, "acceptTerms"))}
          />
          <span>
            Saya menyetujui{" "}
            <Link
              href="/terms"
              target="_blank"
              className="text-primary font-semibold hover:underline"
            >
              Syarat &amp; Ketentuan
            </Link>{" "}
            dan{" "}
            <Link
              href="/privacy"
              target="_blank"
              className="text-primary font-semibold hover:underline"
            >
              Kebijakan Privasi
            </Link>
            .
          </span>
        </label>
        {fieldError(state, "acceptTerms") ? (
          <p className="text-destructive text-xs font-medium">
            {fieldError(state, "acceptTerms")}
          </p>
        ) : null}
      </div>
      <SubmitButton className="w-full" pendingLabel="Menyimpan…">
        Simpan dan lanjutkan
      </SubmitButton>
    </form>
  );
}

type ProfileDefaults = {
  fullName: string;
  username: string;
  bio: string;
  location: string;
};

export function ProfileForm({ defaults }: { defaults: ProfileDefaults }) {
  const [state, action] = useActionState(updateProfileAction, null);
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormAlert state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Nama lengkap"
          htmlFor="fullName"
          error={fieldError(state, "fullName")}
        >
          <Input
            id="fullName"
            name="fullName"
            required
            maxLength={100}
            defaultValue={fieldValue(state, "fullName", defaults.fullName)}
            aria-invalid={Boolean(fieldError(state, "fullName"))}
          />
        </Field>
        <Field
          label="Username"
          htmlFor="username"
          error={fieldError(state, "username")}
        >
          <Input
            id="username"
            name="username"
            required
            minLength={3}
            maxLength={30}
            autoCapitalize="none"
            defaultValue={fieldValue(state, "username", defaults.username)}
            aria-invalid={Boolean(fieldError(state, "username"))}
          />
        </Field>
      </div>
      <Field
        label="Lokasi"
        htmlFor="location"
        error={fieldError(state, "location")}
      >
        <Input
          id="location"
          name="location"
          maxLength={100}
          placeholder="contoh: Tarakan, Kalimantan Utara"
          defaultValue={fieldValue(state, "location", defaults.location)}
          aria-invalid={Boolean(fieldError(state, "location"))}
        />
      </Field>
      <Field
        label="Bio"
        htmlFor="bio"
        error={fieldError(state, "bio")}
        hint="Maksimal 1.000 karakter."
      >
        <Textarea
          id="bio"
          name="bio"
          rows={5}
          maxLength={1000}
          placeholder="Ceritakan sedikit tentang diri Anda."
          defaultValue={fieldValue(state, "bio", defaults.bio)}
          aria-invalid={Boolean(fieldError(state, "bio"))}
        />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Menyimpan…">Simpan profil</SubmitButton>
      </div>
    </form>
  );
}
