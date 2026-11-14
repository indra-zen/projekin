"use client";

import { FileCheck2, Loader2, Upload } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import {
  Field,
  FormAlert,
  SubmitButton,
  fieldError,
  fieldValue,
} from "@/components/forms/form-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  DOCUMENT_TYPES,
  STUDENT_DOCUMENT_BUCKET,
  buildObjectPath,
  validateUpload,
} from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { submitVerificationAction } from "@/server/actions/verification";

export type UniversityOption = {
  id: string;
  name: string;
  emailEligible: boolean;
};

export function VerificationForm({
  userId,
  universities,
}: {
  userId: string;
  universities: UniversityOption[];
}) {
  const [state, action] = useActionState(submitVerificationAction, null);
  const [universityId, setUniversityId] = useState(
    fieldValue(state, "universityId", universities[0]?.id ?? ""),
  );
  const selected = universities.find((u) => u.id === universityId);
  const [method, setMethod] = useState<"email_domain" | "document">(
    fieldValue(state, "method") === "email_domain"
      ? "email_domain"
      : "document",
  );
  const effectiveMethod =
    method === "email_domain" && selected?.emailEligible
      ? "email_domain"
      : "document";

  const fileRef = useRef<HTMLInputElement>(null);
  const [documentPath, setDocumentPath] = useState("");
  const [fileName, setFileName] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function onFile(file: File | undefined) {
    setUploadError(null);
    if (!file) return;
    const invalid = validateUpload(file, DOCUMENT_TYPES);
    if (invalid) {
      setUploadError(invalid);
      return;
    }
    const path = buildObjectPath(userId, file.type, DOCUMENT_TYPES);
    if (!path) return;
    setUploading(true);
    const { error } = await createClient()
      .storage.from(STUDENT_DOCUMENT_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    setUploading(false);
    if (error) {
      setUploadError("Gagal mengunggah dokumen. Coba lagi.");
      return;
    }
    setDocumentPath(path);
    setFileName(file.name);
  }

  if (state?.ok) return <FormAlert state={state} />;

  if (universities.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Belum ada kampus yang tersedia. Hubungi admin Projekin.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-6" noValidate>
      <FormAlert state={state} />
      <input type="hidden" name="method" value={effectiveMethod} />

      <Field
        label="Kampus"
        htmlFor="universityId"
        error={fieldError(state, "universityId")}
      >
        <NativeSelect
          id="universityId"
          name="universityId"
          value={universityId}
          onChange={(event) => setUniversityId(event.target.value)}
        >
          {universities.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <fieldset className="space-y-3">
        <legend className="text-sm font-bold">Metode verifikasi</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              {
                value: "email_domain",
                title: "Email mahasiswa",
                body: selected?.emailEligible
                  ? "Email akun Anda cocok dengan domain kampus. Verifikasi langsung."
                  : "Tidak tersedia: email akun Anda bukan email mahasiswa kampus ini.",
                disabled: !selected?.emailEligible,
              },
              {
                value: "document",
                title: "Unggah KTM",
                body: "Unggah foto/scan Kartu Tanda Mahasiswa. Ditinjau admin.",
                disabled: false,
              },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              className={cn(
                "border-border rounded-xl border-2 p-4 text-sm transition-colors",
                option.disabled
                  ? "cursor-not-allowed opacity-60"
                  : "cursor-pointer",
                effectiveMethod === option.value
                  ? "bg-highlight/60 shadow-hard-sm"
                  : "bg-card hover:bg-highlight/25",
              )}
            >
              <span className="flex items-center gap-2 font-semibold">
                <input
                  type="radio"
                  name="methodChoice"
                  value={option.value}
                  className="accent-primary"
                  checked={effectiveMethod === option.value}
                  disabled={option.disabled}
                  onChange={() => setMethod(option.value)}
                />
                {option.title}
              </span>
              <span className="text-muted-foreground mt-1 block text-xs">
                {option.body}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {effectiveMethod === "document" ? (
        <div className="space-y-5">
          <Field
            label="NIM"
            htmlFor="studentNumber"
            error={fieldError(state, "studentNumber")}
          >
            <Input
              id="studentNumber"
              name="studentNumber"
              maxLength={50}
              required
              defaultValue={fieldValue(state, "studentNumber")}
              aria-invalid={Boolean(fieldError(state, "studentNumber"))}
            />
          </Field>
          <Field
            label="Kartu Tanda Mahasiswa (KTM)"
            htmlFor="ktm"
            error={uploadError ?? fieldError(state, "documentPath")}
            hint="JPG, PNG, atau PDF. Maksimal 5 MB. Hanya Anda dan admin yang dapat melihat dokumen ini."
          >
            <input type="hidden" name="documentPath" value={documentPath} />
            <input
              ref={fileRef}
              id="ktm"
              type="file"
              accept={Object.keys(DOCUMENT_TYPES).join(",")}
              className="sr-only"
              onChange={(event) => {
                void onFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 size-4" />
                )}
                {documentPath ? "Ganti dokumen" : "Pilih dokumen"}
              </Button>
              {documentPath ? (
                <span className="sticker bg-success min-w-0">
                  <FileCheck2 className="size-4 shrink-0" />
                  <span className="truncate">{fileName}</span>
                </span>
              ) : null}
            </div>
          </Field>
        </div>
      ) : null}

      <SubmitButton
        disabled={
          uploading || (effectiveMethod === "document" && !documentPath)
        }
        pendingLabel="Mengirim…"
      >
        {effectiveMethod === "email_domain"
          ? "Verifikasi sekarang"
          : "Kirim pengajuan"}
      </SubmitButton>
    </form>
  );
}
