"use server";

import { redirect } from "next/navigation";
import { confirmPeopleImportExecution } from "@/lib/imports/people-import-execution-data";
import { getImportReview } from "@/lib/imports/people-import-review-data";
import { saveImportDecision } from "@/lib/imports/people-import-review-data";
import { enforceTenantMasterDataOperation } from "@/lib/master-data/tenant-master-data-route-access";

export async function saveDecisionAction(domain: string, revisionId: string, formData: FormData) {
  const principal = await enforceTenantMasterDataOperation(domain, "people-imports.decision.update");
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
  const rowIds = formData.getAll("rowId").map(String);
    const principal = await enforceTenantMasterDataOperation(domain, "people-imports.execute", ["people-imports.revisions.execute"]);
    const review = await getImportReview(principal, revisionId);
    if (!review) redirect(`/${domain}/master/import/${revisionId}?result=not-found`);
    const profileModule = review.revision.kind === "student" ? "students" : review.revision.kind === "teacher" ? "teachers" : "staff";
    const required = new Set<string>(["people-imports.revisions.execute"]);
    for (const row of review.rows.filter((candidate) => rowIds.includes(candidate.id))) {
      if (row.state === "rejected" || row.decision?.action === "skip") continue;
      const action = row.decision?.action === "link" ? "update" : "create";
      required.add(`people.people.${action}`);
      required.add(`${profileModule}.${profileModule}.${action}`);
    }
    const authorizedPrincipal = await enforceTenantMasterDataOperation(domain, "people-imports.execute", [...required]);
    const result = await confirmPeopleImportExecution(authorizedPrincipal, revisionId, rowIds);

  if (result.ok) {
    redirect(`/${domain}/master/import/${revisionId}/execution/${result.executionId}`);
  }

  redirect(`/${domain}/master/import/${revisionId}?result=${result.code}`);
}
