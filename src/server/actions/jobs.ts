"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formDataToObject } from "@/lib/validation/common";
import {
  closeJobSchema,
  jobIdSchema,
  jobSchema,
  proposalIdSchema,
  proposalSchema,
  rejectProposalSchema,
} from "@/lib/validation/job";
import {
  fail,
  ok,
  validationFailed,
  type ActionError,
  type ActionResult,
  type ErrorCode,
  type FormState,
} from "@/server/action-result";
import { guardOnboarded, guardVerifiedFreelancer } from "@/server/auth";
import { messageFor } from "@/server/error-messages";
import { mapPostgresError } from "@/server/errors";

const MAX_ACTIVE_JOBS = 10; // BR-13; the RLS insert policy enforces the same limit.

function reasonError(code: ErrorCode, reason: string): ActionError {
  return { code, reason, message: messageFor(code, reason) };
}

function revalidateJob(jobId: string) {
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/dashboard/jobs");
  revalidatePath(`/dashboard/jobs/${jobId}`);
}

// ---------------------------------------------------------------------------
// Client: job postings
// ---------------------------------------------------------------------------

export async function createJobAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const guard = await guardOnboarded();
  if (!guard.ok) return guard.result;
  const { user } = guard.value;

  const raw = formDataToObject(formData);
  const parsed = jobSchema.safeParse(raw);
  if (!parsed.success) return validationFailed(parsed.error, raw);

  const supabase = await createClient();
  // Friendly pre-check; the RLS insert policy is the actual enforcement.
  const { count } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("client_id", user.id)
    .in("status", ["open", "hiring"]);
  if ((count ?? 0) >= MAX_ACTIVE_JOBS)
    return fail(reasonError("LIMIT_REACHED", "MAX_ACTIVE_JOBS"), raw);

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      client_id: user.id,
      category_id: parsed.data.categoryId,
      title: parsed.data.title,
      description: parsed.data.description,
      requirements: parsed.data.requirements,
      budget_min: parsed.data.budgetMin,
      budget_max: parsed.data.budgetMax,
      deadline: parsed.data.deadline,
    })
    .select("id")
    .single();
  if (error) return fail(mapPostgresError(error), raw);

  revalidateJob(data.id);
  redirect(`/dashboard/jobs/${data.id}` as Route);
}

export async function updateJobAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const guard = await guardOnboarded();
  if (!guard.ok) return guard.result;
  const { user } = guard.value;

  const raw = formDataToObject(formData);
  const id = jobIdSchema.safeParse(raw);
  if (!id.success) return validationFailed(id.error, raw);
  const parsed = jobSchema.safeParse(raw);
  if (!parsed.success) return validationFailed(parsed.error, raw);

  const supabase = await createClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("id, client_id, status, proposals(count)")
    .eq("id", id.data.id)
    .maybeSingle();
  if (!job || job.client_id !== user.id)
    return fail(reasonError("NOT_FOUND", "JOB_NOT_FOUND"), raw);
  const proposalCount = job.proposals[0]?.count ?? 0;
  if (job.status !== "open" || proposalCount > 0) {
    return fail(reasonError("INVALID_STATE", "JOB_NOT_EDITABLE"), raw);
  }

  // RLS (owner, open, no proposals) and column grants are the real enforcement;
  // zero rows means the state changed concurrently.
  const { data, error } = await supabase
    .from("jobs")
    .update({
      category_id: parsed.data.categoryId,
      title: parsed.data.title,
      description: parsed.data.description,
      requirements: parsed.data.requirements,
      budget_min: parsed.data.budgetMin,
      budget_max: parsed.data.budgetMax,
      deadline: parsed.data.deadline,
    })
    .eq("id", id.data.id)
    .select("id");
  if (error) return fail(mapPostgresError(error), raw);
  if (!data || data.length === 0)
    return fail(reasonError("INVALID_STATE", "JOB_NOT_EDITABLE"), raw);

  revalidateJob(id.data.id);
  redirect(`/dashboard/jobs/${id.data.id}` as Route);
}

export async function closeJobAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const guard = await guardOnboarded();
  if (!guard.ok) return guard.result;

  const raw = formDataToObject(formData);
  const parsed = closeJobSchema.safeParse(raw);
  if (!parsed.success) return validationFailed(parsed.error, raw);

  const supabase = await createClient();
  const { error } = await supabase.rpc("close_job", {
    p_job_id: parsed.data.id,
    ...(parsed.data.reason ? { p_reason: parsed.data.reason } : {}),
  });
  if (error) return fail(mapPostgresError(error), raw);

  revalidateJob(parsed.data.id);
  revalidatePath("/dashboard/proposals");
  return ok(
    null,
    "Lowongan ditutup. Proposal yang masih menunggu otomatis ditolak.",
  );
}

// ---------------------------------------------------------------------------
// Freelancer: proposals
// ---------------------------------------------------------------------------

export async function submitProposalAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  // Server-side check from the database state; the RPC re-checks eligibility.
  const guard = await guardVerifiedFreelancer();
  if (!guard.ok) return guard.result;

  const raw = formDataToObject(formData);
  const parsed = proposalSchema.safeParse(raw);
  if (!parsed.success) return validationFailed(parsed.error, raw);

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_proposal", {
    p_job_id: parsed.data.jobId,
    p_cover_letter: parsed.data.coverLetter,
    p_price: parsed.data.price,
    p_delivery_days: parsed.data.deliveryDays,
    p_revisions_included: parsed.data.revisionsIncluded,
  });
  if (error) return fail(mapPostgresError(error), raw);

  revalidateJob(parsed.data.jobId);
  revalidatePath("/dashboard/proposals");
  return ok(
    null,
    "Proposal terkirim. Pantau statusnya di halaman Proposal saya.",
  );
}

export async function withdrawProposalAction(input: {
  proposalId: string;
}): Promise<ActionResult> {
  const guard = await guardOnboarded();
  if (!guard.ok) return guard.result;
  const parsed = proposalIdSchema.safeParse(input);
  if (!parsed.success) return validationFailed(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("withdraw_proposal", {
    p_proposal_id: parsed.data.proposalId,
  });
  if (error) return fail(mapPostgresError(error));

  revalidateJob(data.job_id);
  revalidatePath("/dashboard/proposals");
  return ok(null, "Proposal ditarik.");
}

// ---------------------------------------------------------------------------
// Client: reviewing proposals and hiring
// ---------------------------------------------------------------------------

export async function rejectProposalAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const guard = await guardOnboarded();
  if (!guard.ok) return guard.result;

  const raw = formDataToObject(formData);
  const parsed = rejectProposalSchema.safeParse(raw);
  if (!parsed.success) return validationFailed(parsed.error, raw);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reject_proposal", {
    p_proposal_id: parsed.data.proposalId,
    ...(parsed.data.reason ? { p_reason: parsed.data.reason } : {}),
  });
  if (error) return fail(mapPostgresError(error), raw);

  revalidateJob(data.job_id);
  return ok(null, "Proposal ditolak.");
}

/** Accepts a proposal (job owner only, enforced in the RPC) and opens the new order. */
export async function acceptProposalAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const guard = await guardOnboarded();
  if (!guard.ok) return guard.result;

  const raw = formDataToObject(formData);
  const parsed = proposalIdSchema.safeParse(raw);
  if (!parsed.success) return validationFailed(parsed.error);

  const supabase = await createClient();
  const { data: orderId, error } = await supabase.rpc("accept_proposal", {
    p_proposal_id: parsed.data.proposalId,
  });
  if (error) return fail(mapPostgresError(error));

  revalidatePath("/jobs");
  revalidatePath("/dashboard/jobs", "layout");
  revalidatePath("/dashboard/orders");
  redirect(`/dashboard/orders/${orderId}` as Route);
}
