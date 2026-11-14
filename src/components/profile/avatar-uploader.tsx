"use client";

import { Loader2, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  AVATAR_BUCKET,
  IMAGE_TYPES,
  buildObjectPath,
  validateUpload,
} from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import {
  removeAvatarAction,
  updateAvatarAction,
} from "@/server/actions/profile";

/**
 * Uploads directly to Storage (bucket policy restricts the path to the user's
 * folder; bucket limits enforce size/MIME), then asks the server to save the path.
 */
export function AvatarUploader({
  userId,
  hasAvatar,
  children,
}: {
  userId: string;
  hasAvatar: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const busy = uploading || isPending;

  async function onFileSelected(file: File | undefined) {
    setError(null);
    setMessage(null);
    if (!file) return;
    const invalid = validateUpload(file, IMAGE_TYPES);
    if (invalid) {
      setError(invalid);
      return;
    }
    const path = buildObjectPath(userId, file.type, IMAGE_TYPES);
    if (!path) return;

    setUploading(true);
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, file, {
        contentType: file.type,
        upsert: false,
        cacheControl: "3600",
      });
    setUploading(false);
    if (uploadError) {
      setError("Gagal mengunggah foto. Coba lagi.");
      return;
    }

    startTransition(async () => {
      const result = await updateAvatarAction({ path });
      if (result.ok) {
        setMessage(result.message ?? null);
        router.refresh();
      } else {
        setError(result.error.message);
      }
    });
  }

  function onRemove() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await removeAvatarAction();
      if (result.ok) {
        setMessage(result.message ?? null);
        router.refresh();
      } else {
        setError(result.error.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      {children}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={Object.keys(IMAGE_TYPES).join(",")}
            className="sr-only"
            aria-label="Pilih foto profil"
            onChange={(event) => {
              void onFileSelected(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Upload className="mr-2 size-4" />
            )}
            {hasAvatar ? "Ganti foto" : "Unggah foto"}
          </Button>
          {hasAvatar ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={onRemove}
            >
              <Trash2 className="mr-2 size-4" /> Hapus
            </Button>
          ) : null}
        </div>
        <p className="text-muted-foreground text-xs">
          JPG, PNG, atau WebP. Maksimal 5 MB.
        </p>
        {error ? (
          <p className="text-destructive text-xs font-medium">{error}</p>
        ) : null}
        {message ? (
          <p className="text-primary text-xs font-medium">{message}</p>
        ) : null}
      </div>
    </div>
  );
}
