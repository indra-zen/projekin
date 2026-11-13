import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { requireUser } from "@/server/auth";

export const metadata: Metadata = { title: "Atur ulang kata sandi" };

export default async function ResetPasswordPage() {
  // The recovery link from /auth/confirm establishes a session first.
  await requireUser("/reset-password");
  return (
    <AuthCard
      title="Atur ulang kata sandi"
      description="Buat kata sandi baru untuk akun Anda."
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
