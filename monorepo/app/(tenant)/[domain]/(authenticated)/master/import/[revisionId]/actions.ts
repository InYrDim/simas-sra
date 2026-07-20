"use server";
import { redirect } from "next/navigation";
import { enforceMasterDataAccess } from "@/lib/tenant-master-data-route-access";
import { saveImportDecision } from "@/lib/people-import-review-data";
import { confirmPeopleImportExecution } from "@/lib/people-import-execution-data";
export async function saveDecisionAction(domain:string,revisionId:string,form:FormData){const principal=await enforceMasterDataAccess(domain,"validate-import"),rowId=String(form.get("rowId")??""),action=String(form.get("action")??"") as "link"|"create-distinct"|"skip",target=String(form.get("targetPersonId")??"")||undefined;try{await saveImportDecision(principal,revisionId,rowId,{action,targetPersonId:target});redirect(`/${domain}/master/import/${revisionId}?result=saved`);}catch{redirect(`/${domain}/master/import/${revisionId}?result=invalid-decision`);}}
export async function executeImportAction(domain:string,revisionId:string,form:FormData){const principal=await enforceMasterDataAccess(domain,"execute-import"),rowIds=form.getAll("rowId").map(String);const result=await confirmPeopleImportExecution(principal,revisionId,rowIds);if(result.ok)redirect(`/${domain}/master/import/${revisionId}/execution/${result.executionId}`);redirect(`/${domain}/master/import/${revisionId}?result=${result.code}`);}
