import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Lupa kata sandi" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Lupa kata sandi"
      description="Masukkan email akun Anda. Kami akan mengirim tautan untuk mengatur ulang kata sandi."
      footer={
        <Link href="/login" className="text-primary font-bold hover:underline">
          Kembali ke halaman masuk
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
