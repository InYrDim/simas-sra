import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";
import type { PeopleImportStore } from "@/lib/imports/people-import";
import { importIdentityFingerprint } from "@/lib/imports/people-import-review";
import { closeWorkerTenantAuthorizationPool, createWorkerTenantAuthorizationEvaluator } from "@/lib/authorization/tenant-authorization-worker-data";

const url = process.env.DATABASE_URL;
function pool() { if (!url) throw new Error("DATABASE_URL is required"); return mysql.createPool({ uri: url, connectionLimit: 5 }); }
let database: mysql.Pool | undefined;
const db = () => database ??= pool();

async function validationAuthority(connection: mysql.PoolConnection | undefined, input: { domain: string; actorId?: string; rolloutEpoch?: string | null }) {
  if (!input.actorId || input.rolloutEpoch === null || input.rolloutEpoch === undefined) return false;
  const result = await createWorkerTenantAuthorizationEvaluator(input.actorId, connection).evaluate({
    domain: input.domain,
    operationId: "people-imports.upload",
    surface: "worker",
    expectedRolloutEpoch: BigInt(input.rolloutEpoch),
  });
  return result.kind === "authorized";
}

export const peopleImportStore: PeopleImportStore = {
  async createBatch(input) {
    const connection = await db().getConnection();
    try { await connection.beginTransaction(); await connection.execute("INSERT INTO people_import_batch (id,tenant_id,source_storage_key,source_byte_size,created_by_user_id) VALUES (?,?,?,?,?)", [input.batchId,input.tenantId,input.storageKey,input.byteSize,input.actorId]); await connection.execute("INSERT INTO people_import_validation_job (id,tenant_id,batch_id) VALUES (?,?,?)", [input.jobId,input.tenantId,input.batchId]); await connection.commit(); return { batchId: input.batchId, jobId: input.jobId }; } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  },
  async claimJob(workerId) {
    const connection = await db().getConnection();
    try { await connection.beginTransaction(); const [rows] = await connection.query<mysql.RowDataPacket[]>("SELECT j.id,j.tenant_id,t.domain,j.batch_id,j.attempts,b.source_storage_key,b.created_by_user_id,rollout.epoch rollout_epoch FROM people_import_validation_job j JOIN people_import_batch b ON b.tenant_id=j.tenant_id AND b.id=j.batch_id JOIN tenant t ON t.id=j.tenant_id LEFT JOIN tenant_rbac_rollout rollout ON rollout.tenant_id=j.tenant_id WHERE (j.status='pending' AND j.available_at<=NOW(3)) OR (j.status='processing' AND j.claimed_at<DATE_SUB(NOW(3),INTERVAL 5 MINUTE)) ORDER BY j.created_at LIMIT 1 FOR UPDATE SKIP LOCKED"); const row=rows[0]; if(!row){await connection.commit();return null;} if(!(await validationAuthority(connection,{domain:row.domain,actorId:row.created_by_user_id,rolloutEpoch:row.rollout_epoch===null?null:String(row.rollout_epoch)}))){await connection.execute("UPDATE people_import_validation_job SET status='failed',last_error_code='authority-revoked',claimed_by=NULL WHERE id=?",[row.id]);await connection.commit();return null;} await connection.execute("UPDATE people_import_validation_job SET status='processing',attempts=attempts+1,claimed_by=?,claimed_at=NOW(3) WHERE id=? AND (status='pending' OR (status='processing' AND claimed_at<DATE_SUB(NOW(3),INTERVAL 5 MINUTE)))",[workerId,row.id]); await connection.commit(); return {id:row.id,tenantId:row.tenant_id,domain:row.domain,batchId:row.batch_id,storageKey:row.source_storage_key,attempts:Number(row.attempts)+1,actorId:row.created_by_user_id,claimedBy:workerId,rolloutEpoch:row.rollout_epoch===null?null:String(row.rollout_epoch)}; } catch(error){await connection.rollback();throw error;} finally{connection.release();}
  },
  async completeValidation(input) {
    const connection=await db().getConnection(), revisionId=randomUUID();
    try{await connection.beginTransaction(); const [job]=await connection.query<mysql.RowDataPacket[]>("SELECT status,claimed_by FROM people_import_validation_job WHERE id=? AND tenant_id=? AND batch_id=? FOR UPDATE",[input.jobId,input.tenantId,input.batchId]); if(job[0]?.status==="completed"){await connection.commit();return;} if(job[0]?.status!=="processing" || job[0]?.claimed_by !== input.claimedBy)throw new Error("Job is not claimed"); if(!(await validationAuthority(connection,{domain:input.domain,actorId:input.actorId,rolloutEpoch:input.rolloutEpoch})))throw new Error("authority-revoked"); await connection.execute("INSERT INTO people_import_revision (id,tenant_id,batch_id,entity_kind,template_version,row_count) VALUES (?,?,?,?,?,?)",[revisionId,input.tenantId,input.batchId,input.kind,input.version,input.rows.length]); for(const row of input.rows)await connection.execute("INSERT INTO people_import_row (id,tenant_id,revision_id,row_number,state,values_json,findings_json,identity_fingerprint,candidates_json) VALUES (?,?,?,?,?,?,?,?,?)",[randomUUID(),input.tenantId,revisionId,row.rowNumber,row.state,JSON.stringify(row.values),JSON.stringify(row.findings),importIdentityFingerprint(input.kind,row.values),JSON.stringify([])]); await connection.execute("UPDATE people_import_validation_job SET status='completed',completed_at=NOW(3),claimed_by=NULL WHERE id=?",[input.jobId]); await connection.commit();}catch(error){await connection.rollback();throw error;}finally{connection.release();}
  },
  async failJob(input){await db().execute("UPDATE people_import_validation_job SET status=?,available_at=IF(?,DATE_ADD(NOW(3),INTERVAL LEAST(attempts,5) MINUTE),available_at),last_error_code=?,claimed_by=NULL WHERE id=? AND status='processing'",[input.retryable?"pending":"failed",input.retryable,input.code,input.jobId]);},
};
export async function closePeopleImportPool(){if(database){await database.end();database=undefined;}await closeWorkerTenantAuthorizationPool();}
