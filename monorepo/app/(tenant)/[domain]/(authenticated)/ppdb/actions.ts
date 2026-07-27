"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createPpdbSessionService, type PpdbFormField } from "@/lib/ppdb-session";
import { ppdbSessionStore } from "@/lib/ppdb-session-data";
import { createPpdbSubmissionService } from "@/lib/ppdb-submission";
import { ppdbSubmissionStore } from "@/lib/ppdb-submission-data";
import { enforceMasterDataAccess } from "@/lib/tenant-master-data-route-access";

const sessionService = createPpdbSessionService({ store: ppdbSessionStore });
const submissionService = createPpdbSubmissionService({ store: ppdbSubmissionStore });

function finish(path: string, result: { ok: boolean; code?: string }) {
  revalidatePath(path);
  redirect(`${path}?result=${result.ok ? "saved" : result.code ?? "error"}`);
}

const resultActionCodes = new Set([
  "invalid-input",
  "invalid-result-settings",
  "not-found",
  "session-not-ended",
  "result-feedback-required",
  "pending-submissions",
  "results-already-published",
  "results-unpublished",
  "result-settings-locked",
]);

function finishResults(domain: string, sessionId: string, result: { ok: boolean; code?: string }, successCode: "saved" | "published" | "access-updated") {
  const path = `/${domain}/ppdb/results`;
  const code = result.ok ? successCode : result.code && resultActionCodes.has(result.code) ? result.code : "error";
  revalidatePath(path);
  revalidatePath(`/${domain}/ppdb`);
  revalidatePath(`/${domain}/ppdb/riwayat/${sessionId}`);
  revalidatePath(`/ppdb/${domain}/${sessionId}/status`);
  redirect(`${path}?sessionId=${encodeURIComponent(sessionId)}&result=${code}`);
}

function submissionRedirectPath(domain: string, value: FormDataEntryValue | null) {
  const requested = String(value ?? "");
  if (requested === `/${domain}/ppdb`) return requested;
  const historyPrefix = `/${domain}/ppdb/riwayat/`;
  if (requested.startsWith(historyPrefix) && !requested.slice(historyPrefix.length).includes("/")) return requested;
  return `/${domain}/ppdb`;
}

function parseFields(formData: FormData): PpdbFormField[] {
  try {
    return JSON.parse(String(formData.get("fields") ?? "[]"));
  } catch {
    return [];
  }
}

export async function createSessionAction(domain: string, formData: FormData) {
  const principal = await enforceMasterDataAccess(domain, "write");
  const result = await sessionService.create(principal, {
    academicYearId: String(formData.get("academicYearId") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
  });
  finish(`/${domain}/ppdb/settings`, result);
}

export async function updateFieldsAction(domain: string, formData: FormData) {
  const principal = await enforceMasterDataAccess(domain, "write");
  const result = await sessionService.updateFields(
    principal,
    String(formData.get("sessionId") ?? ""),
    parseFields(formData),
  );
  finish(`/${domain}/ppdb/settings`, result);
}

export async function publishSessionAction(domain: string, formData: FormData) {
  const principal = await enforceMasterDataAccess(domain, "write");
  const sessionId = String(formData.get("sessionId") ?? "");
  const result = await sessionService.publish(
    principal,
    sessionId,
    parseFields(formData),
  );
  revalidatePath(`/ppdb/${domain}/${sessionId}/daftar`);
  finish(`/${domain}/ppdb/settings`, result);
}

export async function endSessionAction(domain: string, formData: FormData) {
  const principal = await enforceMasterDataAccess(domain, "write");
  const result = await sessionService.end(principal, String(formData.get("sessionId") ?? ""));
  finish(`/${domain}/ppdb`, result);
}

export async function updateResultSettingsAction(domain: string, formData: FormData) {
  const principal = await enforceMasterDataAccess(domain, "write");
  const sessionId = String(formData.get("sessionId") ?? "");
  const whatsappGroupUrl = String(formData.get("whatsappGroupUrl") ?? "").trim();
  const result = await sessionService.updateResultSettings(principal, sessionId, {
    acceptedFeedback: String(formData.get("acceptedFeedback") ?? ""),
    acceptedNextSteps: String(formData.get("acceptedNextSteps") ?? ""),
    rejectedFeedback: String(formData.get("rejectedFeedback") ?? ""),
    rejectedNextSteps: String(formData.get("rejectedNextSteps") ?? ""),
    whatsappGroupUrl: whatsappGroupUrl || null,
  });
  finishResults(domain, sessionId, result, "saved");
}

export async function publishResultsAction(domain: string, formData: FormData) {
  const principal = await enforceMasterDataAccess(domain, "write");
  const sessionId = String(formData.get("sessionId") ?? "");
  const result = await sessionService.publishResults(principal, sessionId);
  finishResults(domain, sessionId, result, "published");
}

export async function updateResultCheckAccessAction(domain: string, formData: FormData) {
  const principal = await enforceMasterDataAccess(domain, "write");
  const sessionId = String(formData.get("sessionId") ?? "");
  const open = formData.get("resultCheckOpen") === "true";
  const result = await sessionService.setResultCheckOpen(principal, sessionId, open);
  finishResults(domain, sessionId, result, "access-updated");
}

export async function decideSubmissionAction(domain: string, formData: FormData) {
  const principal = await enforceMasterDataAccess(domain, "write");
  const status = String(formData.get("status") ?? "") as "accepted" | "rejected";
  const scoreRaw = String(formData.get("score") ?? "").trim();
  const score = scoreRaw && Number.isFinite(Number(scoreRaw)) ? Number(scoreRaw) : null;
  const redirectPath = submissionRedirectPath(domain, formData.get("redirectPath"));
  const result = await submissionService.decide(principal, String(formData.get("submissionId") ?? ""), { status, score });
  finish(redirectPath, result);
}
