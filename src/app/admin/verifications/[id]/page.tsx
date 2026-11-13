import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReviewForms } from "@/components/verification/review-forms";
import { formatDate, formatDateTime, isoDateInMonths } from "@/lib/format";
import { STUDENT_DOCUMENT_BUCKET } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";
import { requireAdmin } from "@/server/auth";

export const metadata: Metadata = { title: "Admin · Tinjau verifikasi" };

const statusLabels = {
  pending: "Menunggu peninjauan",
  approved: "Disetujui",
  rejected: "Ditolak",
} as const;

export default async function AdminVerificationDetailPage({
  params,
}: PageProps<"/admin/verifications/[id]">) {
  const viewer = await requireAdmin();
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("student_verifications")
    .select(
      "id, user_id, status, method, student_number, document_path, verified_email, created_at, reviewed_at, valid_until, rejection_reason, university:universities(name), profile:profiles!student_verifications_user_id_fkey(username, full_name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!item) notFound();

  // Signed URL is created with the admin's own session: the storage policy
  // (owner or admin) applies. Short expiry; never a public URL.
  let documentUrl: string | null = null;
  if (item.document_path) {
    const { data } = await supabase.storage
      .from(STUDENT_DOCUMENT_BUCKET)
      .createSignedUrl(item.document_path, 60);
    documentUrl = data?.signedUrl ?? null;
  }
  const isPdf = item.document_path?.endsWith(".pdf") ?? false;
  const isOwn = item.user_id === viewer.user.id;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/verifications"
        className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="size-4" /> Kembali ke antrean
      </Link>

      <div>
        <h1 className="text-3xl font-extrabold tracking-tight break-words">
          {item.profile?.full_name}
        </h1>
        <p className="text-muted-foreground">
          @{item.profile?.username} · {statusLabels[item.status]}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Data pengajuan</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Kampus</dt>
              <dd className="font-medium">{item.university?.name}</dd>
              <dt className="text-muted-foreground">Metode</dt>
              <dd>
                {item.method === "document" ? "Unggah KTM" : "Email mahasiswa"}
              </dd>
              {item.student_number ? (
                <>
                  <dt className="text-muted-foreground">NIM</dt>
                  <dd className="break-all">{item.student_number}</dd>
                </>
              ) : null}
              {item.verified_email ? (
                <>
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="break-all">{item.verified_email}</dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">Diajukan</dt>
              <dd>{formatDateTime(item.created_at)}</dd>
              {item.reviewed_at ? (
                <>
                  <dt className="text-muted-foreground">Ditinjau</dt>
                  <dd>{formatDateTime(item.reviewed_at)}</dd>
                </>
              ) : null}
              {item.valid_until ? (
                <>
                  <dt className="text-muted-foreground">Berlaku hingga</dt>
                  <dd>{formatDate(item.valid_until)}</dd>
                </>
              ) : null}
              {item.rejection_reason ? (
                <>
                  <dt className="text-muted-foreground">Alasan</dt>
                  <dd className="whitespace-pre-wrap">
                    {item.rejection_reason}
                  </dd>
                </>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Dokumen KTM</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {documentUrl ? (
              <>
                {isPdf ? null : (
                  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, not optimisable
                  <img
                    src={documentUrl}
                    alt="Dokumen KTM"
                    className="max-h-[480px] w-full rounded-xl border object-contain"
                  />
                )}
                <a
                  href={documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary inline-flex items-center gap-1 text-sm font-semibold hover:underline"
                >
                  Buka dokumen <ExternalLink className="size-4" />
                </a>
                <p className="text-muted-foreground text-xs">
                  Tautan berlaku 60 detik. Muat ulang halaman jika kedaluwarsa.
                </p>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                {item.document_path
                  ? "Dokumen tidak dapat dimuat."
                  : "Tidak ada dokumen (verifikasi email)."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {item.status === "pending" ? (
        isOwn ? (
          <p className="text-muted-foreground text-sm">
            Anda tidak dapat meninjau pengajuan milik sendiri.
          </p>
        ) : (
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Keputusan</CardTitle>
            </CardHeader>
            <CardContent>
              <ReviewForms
                verificationId={item.id}
                defaultValidUntil={isoDateInMonths(12)}
                minDate={isoDateInMonths(0)}
                maxDate={isoDateInMonths(24)}
              />
            </CardContent>
          </Card>
        )
      ) : null}
    </div>
  );
}
