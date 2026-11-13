"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createClient } from "@/lib/supabase/client";
import { buildObjectPath, IMAGE_TYPES, SERVICE_MEDIA_BUCKET, validateUpload } from "@/lib/storage";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormAlert, SubmitButton, fieldError, fieldValue } from "@/components/forms/form-primitives";
import { createServiceAction, updateServiceAction } from "@/server/actions/services";

type Category = { id: string; name: string };
type Defaults = { id?: string; categoryId: string; title: string; description: string; price: string; deliveryDays: string; revisionsIncluded: string; requirementsPrompt: string; coverImagePath: string | null };

export function ServiceForm({ categories, defaults }: { categories: Category[]; defaults: Defaults }) {
  const action = defaults.id ? updateServiceAction : createServiceAction;
  const [state, formAction] = useActionState(action, null);
  const [uploading, setUploading] = useState(false);
  const [coverPath, setCoverPath] = useState(defaults.coverImagePath ?? "");

  async function uploadCover(file: File) {
    const error = validateUpload(file, IMAGE_TYPES);
    if (error) return window.alert(error);
    setUploading(true);
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setUploading(false); return window.alert("Silakan masuk terlebih dahulu."); }
    const path = buildObjectPath(auth.user.id, file.type, IMAGE_TYPES);
    if (!path) { setUploading(false); return window.alert("Format file tidak valid."); }
    const { error: uploadError } = await supabase.storage.from(SERVICE_MEDIA_BUCKET).upload(path, file, { upsert: false, contentType: file.type });
    setUploading(false);
    if (uploadError) return window.alert("Thumbnail gagal diunggah. Coba lagi.");
    setCoverPath(path);
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormAlert state={state} />
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <input type="hidden" name="coverImagePath" value={coverPath} />
      <Field label="Kategori" htmlFor="categoryId" error={fieldError(state, "categoryId")}>
        <select id="categoryId" name="categoryId" defaultValue={fieldValue(state, "categoryId", defaults.categoryId)} className="border-input h-10 w-full rounded-md border bg-transparent px-3 text-sm">
          <option value="">Pilih kategori</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </Field>
      <Field label="Judul layanan" htmlFor="title" error={fieldError(state, "title")} hint="10–100 karakter.">
        <Input id="title" name="title" maxLength={100} defaultValue={fieldValue(state, "title", defaults.title)} />
      </Field>
      <Field label="Deskripsi" htmlFor="description" error={fieldError(state, "description")} hint="Jelaskan hasil yang akan diterima klien (minimal 50 karakter).">
        <Textarea id="description" name="description" rows={7} maxLength={5000} defaultValue={fieldValue(state, "description", defaults.description)} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Harga (IDR)" htmlFor="price" error={fieldError(state, "price")}><Input id="price" name="price" type="number" min={10000} max={50000000} defaultValue={fieldValue(state, "price", defaults.price)} /></Field>
        <Field label="Waktu pengerjaan (hari)" htmlFor="deliveryDays" error={fieldError(state, "deliveryDays")}><Input id="deliveryDays" name="deliveryDays" type="number" min={1} max={60} defaultValue={fieldValue(state, "deliveryDays", defaults.deliveryDays)} /></Field>
        <Field label="Revisi" htmlFor="revisionsIncluded" error={fieldError(state, "revisionsIncluded")}><Input id="revisionsIncluded" name="revisionsIncluded" type="number" min={0} max={5} defaultValue={fieldValue(state, "revisionsIncluded", defaults.revisionsIncluded)} /></Field>
      </div>
      <Field label="Kebutuhan dari klien" htmlFor="requirementsPrompt" error={fieldError(state, "requirementsPrompt")}><Textarea id="requirementsPrompt" name="requirementsPrompt" rows={3} maxLength={1000} defaultValue={fieldValue(state, "requirementsPrompt", defaults.requirementsPrompt)} /></Field>
      <Field label="Thumbnail layanan" htmlFor="cover" error={fieldError(state, "coverImagePath")} hint="JPG, PNG, atau WebP. Maksimal 5 MB. Wajib untuk publikasi.">
        <Input id="cover" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadCover(file); }} />
        {coverPath ? <p className="text-primary text-xs font-medium">Thumbnail siap digunakan.</p> : null}
      </Field>
      <div className="flex justify-end"><SubmitButton pendingLabel="Menyimpan…" disabled={uploading}>{defaults.id ? "Simpan perubahan" : "Simpan sebagai draf"}</SubmitButton></div>
    </form>
  );
}
