import type { Metadata } from "next";
import Link from "next/link";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { ProfileForm } from "@/components/profile/profile-forms";
import { UserAvatar } from "@/components/profile/user-avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireOnboarded } from "@/server/auth";

export const metadata: Metadata = { title: "Profil saya" };

export default async function ProfileSettingsPage() {
  const { profile, user } = await requireOnboarded(
    "/dashboard/settings/profile",
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Profil saya</h1>
        <p className="text-muted-foreground mt-2">
          Informasi ini tampil di profil publik Anda.
        </p>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Foto profil</CardTitle>
        </CardHeader>
        <CardContent>
          <AvatarUploader
            userId={user.id}
            hasAvatar={Boolean(profile.avatar_path)}
          >
            <UserAvatar
              path={profile.avatar_path}
              name={profile.full_name}
              username={profile.username}
              className="size-20 text-xl"
            />
          </AvatarUploader>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Data profil</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            defaults={{
              fullName: profile.full_name ?? "",
              username: profile.username,
              bio: profile.bio ?? "",
              location: profile.location ?? "",
            }}
          />
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Akun</CardTitle>
          <CardDescription>
            Email tidak ditampilkan kepada pengguna lain.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="break-all">{user.email}</span>
          <Link
            href="/reset-password"
            className="text-primary font-semibold hover:underline"
          >
            Ubah kata sandi
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
