import { eq } from "drizzle-orm";

import { db } from "@/db";
import { providerAdmin, user } from "@/db/schema";

export type ProvisionProviderAdminResult =
  | { status: "created"; userId: string }
  | { status: "already-provisioned"; userId: string }
  | { status: "user-not-found" }
  | { status: "tenant-user"; userId: string };

export type DeprovisionProviderAdminResult =
  | { status: "removed"; userId: string }
  | { status: "not-provisioned"; userId: string }
  | { status: "user-not-found" };

export async function provisionProviderAdmin(
  userId: string,
): Promise<ProvisionProviderAdminResult> {
  return db.transaction(async (tx) => {
    const [candidate] = await tx
      .select({ id: user.id, tenantId: user.tenantId })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)
      .for("update");

    if (!candidate) {
      return { status: "user-not-found" };
    }

    if (candidate.tenantId !== null) {
      return { status: "tenant-user", userId: candidate.id };
    }

    const [existingGrant] = await tx
      .select({ userId: providerAdmin.userId })
      .from(providerAdmin)
      .where(eq(providerAdmin.userId, candidate.id))
      .limit(1);

    if (existingGrant) {
      return { status: "already-provisioned", userId: candidate.id };
    }

    await tx
      .insert(providerAdmin)
      .values({ userId: candidate.id })
      .onDuplicateKeyUpdate({ set: { userId: candidate.id } });

    return { status: "created", userId: candidate.id };
  });
}

export async function provisionProviderAdminByEmail(
  email: string,
): Promise<ProvisionProviderAdminResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const [candidate] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, normalizedEmail))
    .limit(1);

  if (!candidate) {
    return { status: "user-not-found" };
  }

  return provisionProviderAdmin(candidate.id);
}

export async function deprovisionProviderAdmin(
  userId: string,
): Promise<DeprovisionProviderAdminResult> {
  return db.transaction(async (tx) => {
    const [candidate] = await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)
      .for("update");

    if (!candidate) {
      return { status: "user-not-found" };
    }

    const [grant] = await tx
      .select({ userId: providerAdmin.userId })
      .from(providerAdmin)
      .where(eq(providerAdmin.userId, candidate.id))
      .limit(1);

    if (!grant) {
      return { status: "not-provisioned", userId: candidate.id };
    }

    await tx
      .delete(providerAdmin)
      .where(eq(providerAdmin.userId, candidate.id));
    return { status: "removed", userId: candidate.id };
  });
}

export async function deprovisionProviderAdminByEmail(
  email: string,
): Promise<DeprovisionProviderAdminResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const [candidate] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, normalizedEmail))
    .limit(1);

  if (!candidate) {
    return { status: "user-not-found" };
  }

  return deprovisionProviderAdmin(candidate.id);
}
