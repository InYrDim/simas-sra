import type { JsonValue, SecurityActor, SecurityContext } from "@/lib/authorization/security-command";

export type StoredSecurityCommand = Readonly<{
  id: string;
  commandName: string;
  fingerprint: string;
  status: "pending" | "completed" | "failed";
  result: JsonValue | null;
}>;

export type SecurityAuditHead = Readonly<{
  nextSequence: bigint;
  headHash: string;
  version: number;
}>;

export type PersistedSecurityCommand = Readonly<{
  id: string;
  context: SecurityContext;
  idempotencyKey: string;
  commandName: string;
  fingerprint: string;
  createdAt: Date;
}>;

export type PersistedSecurityAuditEvent = Readonly<{
  id: string;
  context: SecurityContext;
  sequence: bigint;
  eventKey: string;
  schemaVersion: number;
  eventType: string;
  actor: SecurityActor;
  commandId: string;
  targets: Readonly<{
    userId?: string;
    roleId?: string;
    assignmentId?: string;
    schoolAdminAuthorityId?: string;
    schoolAdminProofId?: string;
  }>;
  correlationId: string;
  requestId?: string;
 