import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { OnboardingForm } from "@/components/profile/profile-forms";
import { requireUser } from "@/server/auth";

export const metadata: Metadata = { title: "Lengkapi profil" };

export default async function OnboardingPage() {
  const viewer = await requireUser("/onboarding");
  if (viewer.onboarded) redirect("/dashboard");

  return (
    <AuthCard
      title="Lengkapi profil Anda"
      description="Satu langkah lagi. Tentukan nama dan username yang akan tampil di profil publik Anda."
    >
      <OnboardingForm defaultFullName={viewer.profile.full_name ?? ""} />
    </AuthCard>
  );
}
