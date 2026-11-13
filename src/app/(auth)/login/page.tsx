import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/auth-forms";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { safeNextPath } from "@/lib/auth/routes";

export const metadata: Metadata = { title: "Masuk" };

const errorMessages: Record<string, string> = {
  link_invalid: "Tautan tidak valid atau sudah kedaluwarsa. Silakan coba lagi.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next =
    typeof params.next === "string" ? safeNextPath(params.next, "") : "";
  const error =
    typeof params.error === "string" ? errorMessages[params.error] : undefined;

  return (
    <AuthCard
      title="Selamat datang kembali"
      description="Masuk untuk melanjutkan ke ruang kerja Projekin Anda."
      footer={
        <>
          Belum punya akun?{" "}
          <Link
            href="/register"
            className="text-primary font-bold hover:underline"
          >
            Daftar sekarang
          </Link>
        </>
      }
    >
      {error ? (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <LoginForm next={next || undefined} />
    </AuthCard>
  );
}
