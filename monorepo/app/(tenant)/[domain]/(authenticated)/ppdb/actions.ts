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
  const result = await sessionService.publish(
    principal,
    String(formData.get("sessionId") ?? ""),
    parseFields(formData),
  );
  revalidatePath(`/apply/${domain}`);
  finish(`/${domain}/ppdb/settings`, result);
}

export async function endSessionAction(domain: string, formData: FormData) {
  const principal = await enforceMasterDataAccess(domain, "write");
  const result = await sessionService.end(principal, String(formData.get("sessionId") ?? ""));
  finish(`/${domain}/ppdb`, result);
}

export async function decideSubmissionAction(domain: string, formData: FormData) {
  const principal = await enforceMasterDataAccess(domain, "write");
  const status = String(formData.get("status") ?? "") as "accepted" | "rejected";
  const scoreRaw = String(formData.get("score") ?? "").trim();
  const score = scoreRaw && Number.isFinite(Number(scoreRaw)) ? Number(scoreRaw) : null;
  const redirectPath = String(formData.get("redirectPath") ?? `/${domain}/ppdb`);
  const result = await submissionService.decide(principal, String(formData.get("submissionId") ?? ""), { status, score });
  finish(redirectPath, result);
}
