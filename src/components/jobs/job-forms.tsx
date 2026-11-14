"use client";

import { useActionState, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  acceptProposalAction,
  closeJobAction,
  createJobAction,
  rejectProposalAction,
  submitProposalAction,
  updateJobAction,
} from "@/server/actions/jobs";

export type JobFormDefaults = {
  id?: string;
  categoryId: string;
  title: string;
  description: string;
  requirements: string;
  budgetMin: string;
  budgetMax: string;
  deadline: string;
};

export function JobForm({
  categories,
  defaults,
  minDate,
}: {
  categories: { id: string; name: string }[];
  defaults: JobFormDefaults;
  minDate: string;
}) {
  const [state, action] = useActionState(
    defaults.id ? updateJobAction : createJobAction,
    null,
  );
  const v = (name: keyof JobFormDefaults) =>
    fieldValue(state, name, defaults[name] ?? "");
  const err = (name: string) => fieldError(state, name);

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormAlert state={state} />
      {defaults.id ? (
        <input type="hidden" name="id" value={defaults.id} />
      ) : null}
      <Field
        label="Judul pekerjaan"
        htmlFor="title"
        error={err("title")}
        hint="10–100 karakter."
      >
        <Input
          id="title"
          name="title"
          maxLength={100}
          defaultValue={v("title")}
          aria-invalid={Boolean(err("title"))}
        />
      </Field>
      <Field label="Kategori" htmlFor="categoryId" error={err("categoryId")}>
        <NativeSelect
          id="categoryId"
          name="categoryId"
          defaultValue={v("categoryId")}
        >
          <option value="">Pilih kategori</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field
        label="Deskripsi"
        htmlFor="description"
        error={err("description")}
        hint="Jelaskan kebutuhan dan hasil yang diharapkan (minimal 50 karakter)."
      >
        <Textarea
          id="description"
          name="description"
          rows={7}
          maxLength={5000}
          defaultValue={v("description")}
          aria-invalid={Boolean(err("description"))}
        />
      </Field>
      <Field
        label="Persyaratan (opsional)"
        htmlFor="requirements"
        error={err("requirements")}
        hint="Mis. keahlian, format file, atau referensi. Maksimal 3.000 karakter."
      >
        <Textarea
          id="requirements"
          name="requirements"
          rows={4}
          maxLength={3000}
          defaultValue={v("requirements")}
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field
          label="Anggaran minimum (Rp)"
          htmlFor="budgetMin"
          error={err("budgetMin")}
        >
          <Input
            id="budgetMin"
            name="budgetMin"
            type="number"
            inputMode="numeric"
            min={10000}
            max={50000000}
            step={1000}
            defaultValue={v("budgetMin")}
            aria-invalid={Boolean(err("budgetMin"))}
          />
        </Field>
        <Field
          label="Anggaran maksimum (Rp)"
          htmlFor="budgetMax"
          error={err("budgetMax")}
        >
          <Input
            id="budgetMax"
            name="budgetMax"
            type="number"
            inputMode="numeric"
            min={10000}
            max={50000000}
            step={1000}
            defaultValue={v("budgetMax")}
            aria-invalid={Boolean(err("budgetMax"))}
          />
        </Field>
        <Field
          label="Tenggat (opsional)"
          htmlFor="deadline"
          error={err("deadline")}
        >
          <Input
            id="deadline"
            name="deadline"
            type="date"
            min={minDate}
            defaultValue={v("deadline")}
            aria-invalid={Boolean(err("deadline"))}
          />
        </Field>
      </div>
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Menyimpan…">
          {defaults.id ? "Simpan perubahan" : "Publikasikan lowongan"}
        </SubmitButton>
      </div>
    </form>
  );
}

export function CloseJobForm({ jobId }: { jobId: string }) {
  const [state, action] = useActionState(closeJobAction, null);
  const [open, setOpen] = useState(false);
  if (state?.ok) return <FormAlert state={state} />;
  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        Tutup / batalkan lowongan
      </Button>
    );
  }
  return (
    <form
      action={action}
      className="bg-card border-border shadow-hard-sm w-full space-y-3 rounded-2xl border-2 p-4"
      noValidate
    >
      <FormAlert state={state} />
      <input type="hidden" name="id" value={jobId} />
      <Field
        label="Alasan (opsional)"
        htmlFor="close-reason"
        error={fieldError(state, "reason")}
        hint="Proposal yang masih menunggu akan otomatis ditolak."
      >
        <Textarea id="close-reason" name="reason" rows={2} maxLength={500} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <SubmitButton variant="outline" pendingLabel="Menutup…">
          Ya, tutup lowongan
        </SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Batal
        </Button>
      </div>
    </form>
  );
}

export function ProposalForm({
  jobId,
  budgetHint,
}: {
  jobId: string;
  budgetHint: string;
}) {
  const [state, action] = useActionState(submitProposalAction, null);
  const err = (name: string) => fieldError(state, name);
  if (state?.ok) return <FormAlert state={state} />;
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormAlert state={state} />
      <input type="hidden" name="jobId" value={jobId} />
      <Field
        label="Surat pengantar"
        htmlFor="coverLetter"
        error={err("coverLetter")}
        hint="Ceritakan pengalaman dan rencana Anda (50–3.000 karakter)."
      >
        <Textarea
          id="coverLetter"
          name="coverLetter"
          rows={6}
          maxLength={3000}
          defaultValue={fieldValue(state, "coverLetter")}
          aria-invalid={Boolean(err("coverLetter"))}
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field
          label="Harga penawaran (Rp)"
          htmlFor="price"
          error={err("price")}
          hint={budgetHint}
        >
          <Input
            id="price"
            name="price"
            type="number"
            inputMode="numeric"
            min={10000}
            max={50000000}
            step={1000}
            defaultValue={fieldValue(state, "price")}
            aria-invalid={Boolean(err("price"))}
          />
        </Field>
        <Field
          label="Waktu pengerjaan (hari)"
          htmlFor="deliveryDays"
          error={err("deliveryDays")}
        >
          <Input
            id="deliveryDays"
            name="deliveryDays"
            type="number"
            min={1}
            max={60}
            defaultValue={fieldValue(state, "deliveryDays")}
            aria-invalid={Boolean(err("deliveryDays"))}
          />
        </Field>
        <Field
          label="Revisi termasuk"
          htmlFor="revisionsIncluded"
          error={err("revisionsIncluded")}
        >
          <Input
            id="revisionsIncluded"
            name="revisionsIncluded"
            type="number"
            min={0}
            max={5}
            defaultValue={fieldValue(state, "revisionsIncluded", "1")}
            aria-invalid={Boolean(err("revisionsIncluded"))}
          />
        </Field>
      </div>
      <SubmitButton pendingLabel="Mengirim…">Kirim proposal</SubmitButton>
    </form>
  );
}

/** Accept (with inline confirmation) and reject controls for one proposal. */
export function ProposalDecision({
  proposalId,
  freelancerName,
}: {
  proposalId: string;
  freelancerName: string;
}) {
  const [acceptState, acceptAction] = useActionState(
    acceptProposalAction,
    null,
  );
  const [rejectState, rejectAction] = useActionState(
    rejectProposalAction,
    null,
  );
  const [mode, setMode] = useState<"idle" | "accept" | "reject">("idle");

  if (rejectState?.ok) return <FormAlert state={rejectState} />;

  return (
    <div className="space-y-3">
      <FormAlert state={acceptState} />
      <FormAlert state={rejectState} />
      {mode === "idle" ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => setMode("accept")}>
            Terima &amp; rekrut
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setMode("reject")}
          >
            Tolak
          </Button>
        </div>
      ) : null}
      {mode === "accept" ? (
        <form
          action={acceptAction}
          className="bg-card border-border shadow-hard-sm space-y-3 rounded-2xl border-2 p-4"
        >
          <input type="hidden" name="proposalId" value={proposalId} />
          <p className="text-sm">
            Rekrut <strong>{freelancerName}</strong>? Lowongan akan berhenti
            menerima proposal dan pesanan dibuat dengan status menunggu
            pembayaran (batas 24 jam).
          </p>
          <div className="flex flex-wrap gap-2">
            <SubmitButton pendingLabel="Memproses…">Ya, rekrut</SubmitButton>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setMode("idle")}
            >
              Batal
            </Button>
          </div>
        </form>
      ) : null}
      {mode === "reject" ? (
        <form
          action={rejectAction}
          className="bg-card border-border shadow-hard-sm space-y-3 rounded-2xl border-2 p-4"
          noValidate
        >
          <input type="hidden" name="proposalId" value={proposalId} />
          <Field
            label="Alasan (opsional, terlihat oleh freelancer)"
            htmlFor={`reason-${proposalId}`}
            error={fieldError(rejectState, "reason")}
          >
            <Textarea
              id={`reason-${proposalId}`}
              name="reason"
              rows={2}
              maxLength={500}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <SubmitButton variant="outline" pendingLabel="Menolak…">
              Tolak proposal
            </SubmitButton>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setMode("idle")}
            >
              Batal
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
