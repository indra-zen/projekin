import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { env } from "@/lib/env";
import { AVATAR_BUCKET, publicObjectUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";

export function avatarUrl(path: string | null | undefined): string | undefined {
  return path
    ? publicObjectUrl(env.NEXT_PUBLIC_SUPABASE_URL, AVATAR_BUCKET, path)
    : undefined;
}

export function initials(
  name: string | null | undefined,
  fallback: string,
): string {
  const source = (name || fallback).trim();
  const parts = source.split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1 ? `${parts[0]![0]}${parts[1]![0]}` : source.slice(0, 2);
  return letters.toUpperCase();
}

export function UserAvatar({
  path,
  name,
  username,
  className,
}: {
  path: string | null | undefined;
  name: string | null | undefined;
  username: string;
  className?: string;
}) {
  const src = avatarUrl(path);
  return (
    <Avatar className={cn("size-10", className)}>
      {src ? <AvatarImage src={src} alt={name ?? username} /> : null}
      <AvatarFallback className="bg-secondary text-secondary-foreground font-bold">
        {initials(name, username)}
      </AvatarFallback>
    </Avatar>
  );
}
