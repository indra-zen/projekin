import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { VerificationBadge } from "@/components/verification/verification-badge";
import {
  VerificationForm,
  type UniversityOption,
} from "@/components/verification/verification-form";
import { formatDate, formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getVerificationStatus, requireOnboarded } from "@/server/auth";

export const metadata: Metadata = { title: "Verifikasi mahasiswa" };

const requestStatusLabels = {
  pending: "Menunggu peninjauan",
  approved: "Disetujui",
  rejected: "Ditolak",
} as const;

export default async function VerificationPage() {
  const { user } = await requireOnboarded("/dashboard/verification");
  const status = await getVerificationStatus();
  const supabase = await createClient();

  const [{ data: universities }, { data: history }] = await Promise.all([
    supabase
      .from("universities")
      .select("id, name, email_domains")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("student_verifications")
      .select(
        "id, method, status, created_at, reviewed_at, valid_until, rejection_reason, university:universities(name)",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  // Display hint only; the RPC re-checks the confirmed email domain server-side.
  const domain = user.email?.split("@")[1]?.toLowerCase() ?? "";
  const options: UniversityOption[] = (universities ?? []).map((u) => ({
    id: u.id,
    name: u.name,
    emailEligible: domain !== "" && u.email_domains.includes(domain),
  }));
  const state = status?.state ?? "unverified";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">
          Verifikasi mahasiswa
        </h1>
        <p className="text-muted-foreground mt-2">
          Hanya mahasiswa terverifikasi yang dapat menawarkan jasa dan mengirim
          proposal. Anda tetap dapat memesan jasa tanpa verifikasi.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
            Status: <VerificationBadge state={state} />
          </CardTitle>
          <CardDescription>
            {state === "verified" && status?.verifiedUntil
              ? `Berlaku hingga ${formatDate(status.verifiedUntil)}.`
              : state === "pending"
                ? "Pengajuan Anda sedang ditinjau admin."
                : state === "rejected"
                  ? "Pengajuan terakhir Anda ditolak. Anda dapat mengajukan kembali."
                  : "Anda belum terverifikasi sebagai mahasiswa."}
          </CardDescription>
        </CardHeader>
        {state === "rejected" && status?.latestRejectionReason ? (
          <CardContent>
            <p className="bg-danger-soft border-destructive rounded-xl border-2 p-3 text-sm font-medium">
              Alasan: {status.latestRejectionReason}
            </p>
          </CardContent>
        ) : null}
        {status?.isSuspended ? (
          <CardContent>
            <p className="text-destructive text-sm">
              Akun freelancer Anda sedang ditangguhkan. Hubungi admin Projekin.
            </p>
          </CardContent>
        ) : null}
      </Card>

      {status?.canSubmit ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {state === "verified"
                ? "Perpanjang verifikasi"
                : "Ajukan verifikasi"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <VerificationForm userId={user.id} universities={options} />
          </CardContent>
        </Card>
      ) : null}

      {history && history.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Riwayat pengajuan</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-hairline divide-y">
              {history.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <span>
                    <span className="font-medium">{item.university?.name}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {item.method === "document"
                        ? "KTM"
                        : "Email mahasiswa"}{" "}
                      · {formatDateTime(item.created_at)}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    {requestStatusLabels[item.status]}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
