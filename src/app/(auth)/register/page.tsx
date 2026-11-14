import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Daftar" };

export default function RegisterPage() {
  return (
    <AuthCard
      title="Buat akun Projekin"
      description="Satu akun untuk memesan jasa dan, jika Anda mahasiswa, menawarkan jasa sebagai freelancer."
      footer={
        <>
          Sudah punya akun?{" "}
          <Link
            href="/login"
            className="text-primary font-bold hover:underline"
          >
            Masuk
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
