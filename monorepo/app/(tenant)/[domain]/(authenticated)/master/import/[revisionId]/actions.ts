"use server";

import { redirect } from "next/navigation";
import { confirmPeopleImportExecution } from "@/lib/people-import-execution-data";
import { saveImportDecision } from "@/lib/people-import-review-data";
import { enforceMasterDataAccess } from "@/lib/tenant-master-data-route-access";

export async function saveDecisionAction(domain: string, revisionId: string, formData: FormData) {
  const principal = await enforceMasterDataAccess(domain, "validate-import");
  const rowId = String(formData.get("rowId") ?? "");
  const action = String(formData.get("action") ?? "") as "link" | "create-distinct" | "skip";
  const targetPersonId = String(formData.get("targetPersonId") ?? "") || undefined;
  let resultCode = "saved";

  try {
    await saveImportDecision(principal, revisionId, rowId, { action, targetPersonId });
  } catch {
    resultCode = "invalid-decision";
  }

  redirect(`/${domain}/master/import/${revisionId}?result=${resultCode}`);
}

export async function executeImportAction(domain: string, revisionId: string, formData: FormData) {
  const principal = await enforceMasterDataAccess(domain, "execute-import");
  const rowIds = formData.getAll("rowId").map(String);
  const result = await confirmPeopleImportExecution(principal, revisionId, rowIds);

  if (result.ok) {
    redirect(`/${domain}/master/import/${revisionId}/execution/${result.executionId}`);
  }

  redirect(`/${domain}/master/import/${revisionId}?result=${result.code}`);
}
