import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { VerificationBadge } from "@/components/verification/verification-badge";
import { FreelancerProfileForm } from "@/components/verification/freelancer-profile-form";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getVerificationStatus, requireOnboarded } from "@/server/auth";

export const metadata: Metadata = { title: "Profil freelancer" };

export default async function FreelancerProfilePage() {
  const { user } = await requireOnboarded("/dashboard/freelancer");
  const status = await getVerificationStatus();
  const supabase = await createClient();
  const { data: freelancer } = await supabase
    .from("freelancer_profiles")
    .select(
      "headline, major, skills, verified_until, status, university:universities(name)",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">
          Profil freelancer
        </h1>
        <p className="text-muted-foreground mt-2">
          Tampil di profil publik Anda bersama lencana mahasiswa terverifikasi.
        </p>
      </div>

      {!freelancer ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Belum menjadi freelancer</CardTitle>
            <CardDescription>
              Profil freelancer dibuat otomatis setelah verifikasi mahasiswa
              Anda disetujui.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/dashboard/verification">
                Verifikasi sebagai mahasiswa
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                {freelancer.university?.name}{" "}
                <VerificationBadge state={status?.state ?? "unverified"} />
              </CardTitle>
              <CardDescription>
                {freelancer.status === "suspended"
                  ? "Akun freelancer ditangguhkan."
                  : `Verifikasi berlaku hingga ${formatDate(freelancer.verified_until)}.`}
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Detail freelancer</CardTitle>
            </CardHeader>
            <CardContent>
              <FreelancerProfileForm
                defaults={{
                  headline: freelancer.headline ?? "",
                  major: freelancer.major ?? "",
                  skills: freelancer.skills.join(", "),
                }}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
