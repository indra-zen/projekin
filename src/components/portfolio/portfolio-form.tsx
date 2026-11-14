"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  buildObjectPath,
  IMAGE_TYPES,
  PORTFOLIO_BUCKET,
  validateUpload,
} from "@/lib/storage";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FormAlert,
  SubmitButton,
  fieldError,
  fieldValue,
} from "@/components/forms/form-primitives";
import {
  createPortfolioItemAction,
  updatePortfolioItemAction,
} from "@/server/actions/portfolio";

type Defaults = {
  id?: string;
  title: string;
  description: string;
  externalUrl: string;
  imagePaths: string[];
  sortOrder: string;
};

export function PortfolioForm({ defaults }: { defaults: Defaults }) {
  const [state, action] = useActionState(
    defaults.id ? updatePortfolioItemAction : createPortfolioItemAction,
    null,
  );
  const [paths, setPaths] = useState(defaults.imagePaths);
  const [uploading, setUploading] = useState(false);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    if (paths.length + files.length > 5)
      return window.alert("Maksimal 5 gambar per karya.");
    setUploading(true);
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setUploading(false);
      return window.alert("Silakan masuk terlebih dahulu.");
    }
    const next: string[] = [];
    for (const file of Array.from(files)) {
      const validation = validateUpload(file, IMAGE_TYPES);
      if (validation) {
        setUploading(false);
        return window.alert(validation);
      }
      const path = buildObjectPath(auth.user.id, file.type, IMAGE_TYPES);
      if (!path) {
        setUploading(false);
        return window.alert("Format gambar tidak valid.");
      }
      const { error } = await supabase.storage
        .from(PORTFOLIO_BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) {
        setUploading(false);
        return window.alert("Gambar gagal diunggah.");
      }
      next.push(path);
    }
    setPaths((current) => [...current, ...next]);
    setUploading(false);
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormAlert state={state} />
      {defaults.id ? (
        <input type="hidden" name="id" value={defaults.id} />
      ) : null}
      <input type="hidden" name="imagePaths" value={JSON.stringify(paths)} />
      <Field
        label="Judul karya"
        htmlFor="title"
        error={fieldError(state, "title")}
      >
        <Input
          id="title"
          name="title"
          maxLength={100}
          defaultValue={fieldValue(state, "title", defaults.title)}
        />
      </Field>
      <Field
        label="Deskripsi"
        htmlFor="description"
        error={fieldError(state, "description")}
      >
        <Textarea
          id="description"
          name="description"
          maxLength={2000}
          rows={5}
          defaultValue={fieldValue(state, "description", defaults.description)}
        />
      </Field>
      <Field
        label="URL karya (opsional)"
        htmlFor="externalUrl"
        error={fieldError(state, "externalUrl")}
        hint="Gunakan URL HTTPS."
      >
        <Input
          id="externalUrl"
          name="externalUrl"
          type="url"
          defaultValue={fieldValue(state, "externalUrl", defaults.externalUrl)}
        />
      </Field>
      <Field
        label="Gambar karya"
        htmlFor="images"
        error={fieldError(state, "imagePaths")}
        hint="Maksimal 5 gambar, masing-masing maksimal 5 MB."
      >
        <Input
          id="images"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={uploading || paths.length >= 5}
          onChange={(event) => void upload(event.target.files)}
        />
        <div className="flex flex-wrap gap-2">
          {paths.map((path, index) => (
            <button
              type="button"
              key={path}
              className="bg-muted rounded px-2 py-1 text-xs"
              onClick={() =>
                setPaths((current) =>
                  current.filter((_, item) => item !== index),
                )
              }
            >
              Gambar {index + 1} ×
            </button>
          ))}
        </div>
      </Field>
      <Field
        label="Urutan tampil"
        htmlFor="sortOrder"
        error={fieldError(state, "sortOrder")}
      >
        <Input
          id="sortOrder"
          name="sortOrder"
          type="number"
          min={0}
          defaultValue={fieldValue(state, "sortOrder", defaults.sortOrder)}
        />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Menyimpan…" disabled={uploading}>
          {defaults.id ? "Simpan perubahan" : "Tambah karya"}
        </SubmitButton>
      </div>
    </form>
  );
}
