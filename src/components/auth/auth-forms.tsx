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
import {
  forgotPasswordAction,
  loginAction,
  registerAction,
  resetPasswordAction,
} from "@/server/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(loginAction, null);
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormAlert state={state} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label="Email" htmlFor="email" error={fieldError(state, "email")}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="nama@email.com"
          defaultValue={fieldValue(state, "email")}
          aria-invalid={Boolean(fieldError(state, "email"))}
          className="h-11"
        />
      </Field>
      <Field
        label="Kata sandi"
        htmlFor="password"
        error={fieldError(state, "password")}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(fieldError(state, "password"))}
          className="h-11"
        />
      </Field>
      <div className="flex justify-end text-sm">
        <Link
          href="/forgot-password"
          className="text-primary font-semibold hover:underline"
        >
          Lupa kata sandi?
        </Link>
      </div>
      <SubmitButton className="w-full" pendingLabel="Masuk…">
        Masuk
      </SubmitButton>
    </form>
  );
}

export function RegisterForm() {
  const [state, action] = useActionState(registerAction, null);
  if (state?.ok) return <FormAlert state={state} />;
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
          autoComplete="name"
          required
          maxLength={100}
          placeholder="Nama sesuai identitas"
          defaultValue={fieldValue(state, "fullName")}
          aria-invalid={Boolean(fieldError(state, "fullName"))}
          className="h-11"
        />
      </Field>
      <Field label="Email" htmlFor="email" error={fieldError(state, "email")}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="nama@email.com"
          defaultValue={fieldValue(state, "email")}
          aria-invalid={Boolean(fieldError(state, "email"))}
          className="h-11"
        />
      </Field>
      <Field
        label="Kata sandi"
        htmlFor="password"
        error={fieldError(state, "password")}
        hint="Minimal 8 karakter."
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          aria-invalid={Boolean(fieldError(state, "password"))}
          className="h-11"
        />
      </Field>
      <SubmitButton className="w-full" pendingLabel="Mendaftar…">
        Daftar
      </SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPasswordAction, null);
  if (state?.ok) return <FormAlert state={state} />;
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormAlert state={state} />
      <Field label="Email" htmlFor="email" error={fieldError(state, "email")}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={fieldValue(state, "email")}
          aria-invalid={Boolean(fieldError(state, "email"))}
          className="h-11"
        />
      </Field>
      <SubmitButton className="w-full" pendingLabel="Mengirim…">
        Kirim tautan atur ulang
      </SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState(resetPasswordAction, null);
  if (state?.ok) {
    return (
      <div className="space-y-5">
        <FormAlert state={state} />
        <Link
          href="/dashboard"
          className="text-primary block text-center font-semibold hover:underline"
        >
          Ke dasbor
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormAlert state={state} />
      <Field
        label="Kata sandi baru"
        htmlFor="password"
        error={fieldError(state, "password")}
        hint="Minimal 8 karakter."
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          aria-invalid={Boolean(fieldError(state, "password"))}
          className="h-11"
        />
      </Field>
      <Field
        label="Ulangi kata sandi baru"
        htmlFor="confirmPassword"
        error={fieldError(state, "confirmPassword")}
      >
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(fieldError(state, "confirmPassword"))}
          className="h-11"
        />
      </Field>
      <SubmitButton className="w-full" pendingLabel="Menyimpan…">
        Simpan kata sandi
      </SubmitButton>
    </form>
  );
}
