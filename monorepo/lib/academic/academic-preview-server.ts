import "server-only";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";

import { db } from "@/db";
import { tenant, user } from "@/db/schema";
import { academicPreviewStore } from "@/lib/academic/academic-preview-data";
import { createAcademicPreviewService, type AcademicCommitResult } from "@/lib/academic/academic-preview";
import { enforceAcademicAccess } from "@/lib/master-data/tenant-master-data-route-access";
import { auth } from "@/lib/platform/auth";

function service() {
  const secret = process.env.ACADEMIC_PREVIEW_SECRET ?? process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("ACADEMIC_PREVIEW_SECRET must contain at least 32 characters");
  return createAcademicPreviewService({ store: academicPreviewStore, secret });
}

export async function createAuthorizedAcademicPreview(input: {
  domain: string;
  operationId: string;
  payload: Readonly<Record<string, unknown>>;
  requestedPermissions?: readonly string[];
}) {
  const principal = await enforceAcademicAccess(input.domain, input.operationId, input.requestedPermissions);
  return service().create({
    tenantId: principal.tenantId,
    actorUserId: principal.userId,
    operationId: input.operationId,
    payload: input.payload,
  });
}

export async function commitAuthorizedAcademicPreview(input: {
  domain: string;
  operationId: string;
  token: string;
  idempotencyKey: string;
  payload: Readonly<Record<string, unknown>>;
  requestedPermissions?: readonly string[];
  mutate: () => Promise<unknown>;
}): Promise<AcademicCommitResult> {
  if (input.idempotencyKey.length > 128) return { ok: false, code: "academic-preview-no-longer-valid" };
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, code: "academic-preview-no-longer-valid" };
  const [principal] = await db.select({ userId: user.id, tenantId: tenant.id }).from(user).innerJoin(tenant, eq(user.tenantId, tenant.id)).where(and(eq(user.id, session.user.id), eq(tenant.domain, input.domain))).limit(1);
  if (!principal) return { ok: false, code: "academic-preview-no-longer-valid" };
  return service().commit({
    token: input.token,
    idempotencyKey: input.idempotencyKey,
    intent: {
      tenantId: principal.tenantId,
      actorUserId: principal.userId,
      operationId: input.operationId,
      payload: input.payload,
    },
    reauthorize: async () => {
      try {
        await enforceAcademicAccess(input.domain, input.operationId, input.requestedPermissions);
        return true;
      } catch {
        return false;
      }
    },
    mutate: input.mutate,
  });
}
