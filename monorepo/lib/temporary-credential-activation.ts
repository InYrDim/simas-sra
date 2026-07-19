import { randomBytes } from "node:crypto";

import { hashPassword, verifyPassword } from "better-auth/crypto";

import type { ProviderPrincipal } from "@/lib/provider-access";

export type TenantPrincipal = Readonly<{
  userId: string;
  tenantId: string;
  tenantRole: "school-admin";
}>;

type ActivationState = Readonly<{
  userId: string;
  firstAuthenticatedAt: Date | null;
  passwordChangeRequired: boolean;
}>;

type ActivationTransaction = Readonly<{
  lock(userId: string): Promise<ActivationState | null>;
  getCredentialHash(userId: string): Promise<string | null>;
  replaceCredential(userId: string, credentialHash: string): Promise<void>;
  revokeOtherSessions(userId: string, currentSessionId: string): Promise<void>;
  revokeAllSessions(userId: string): Promise<void>;
  completePasswordChange(userId: string, changedAt: Date): Promise<void>;
  reissueTemporaryCredential(userId: string, issuedAt: Date): Promise<void>;
}>;

export type TemporaryCredentialActivationStore = Readonly<{
  recordFirstAuthentication(userId: string, authenticatedAt: Date): Promise<void>;
  getTenantPrincipal(userId: string): Promise<(TenantPrincipal & {
    passwordChangeRequired: boolean;
  }) | null>;
  transaction<T>(work: (tx: ActivationTransaction) => Promise<T>): Promise<T>;
}>;

export class TenantActivationError extends Error {
  readonly code: "forbidden" | "password-change-required";

  constructor(code: "forbidden" | "password-change-required") {
    super(code === "password-change-required" ? "Password change required" : "Tenant access forbidden");
    this.name = "TenantActivationError";
    this.code = code;
  }
}

export class TemporaryCredentialResetDeniedError extends Error {
  constructor() {
    super("Temporary credential reset is unavailable after first authentication");
    this.name = "TemporaryCredentialResetDeniedError";
  }
}

export function createRecordFirstAuthenticationCommand(dependencies: {
  store: TemporaryCredentialActivationStore;
  now?: () => Date;
}) {
  const now = dependencies.now ?? (() => new Date());
  return (userId: string) => dependencies.store.recordFirstAuthentication(userId, now());
}

export async function requireActivatedTenantPrincipal(
  userId: string,
  tenantId: string,
  store: TemporaryCredentialActivationStore,
): Promise<TenantPrincipal> {
  const principal = await store.getTenantPrincipal(userId);
  if (!principal || principal.tenantId !== tenantId || principal.tenantRole !== "school-admin") {
    throw new TenantActivationError("forbidden");
  }
  if (principal.passwordChangeRequired) {
    throw new TenantActivationError("password-change-required");
  }
  return {
    userId: principal.userId,
    tenantId: principal.tenantId,
    tenantRole: principal.tenantRole,
  };
}

export function createChangeSchoolAdminPasswordCommand(dependencies: {
  store: TemporaryCredentialActivationStore;
  hashPassword?: (password: string) => Promise<string>;
  verifyPassword?: (input: { hash: string; password: string }) => Promise<boolean>;
  now?: () => Date;
}) {
  const createHash = dependencies.hashPassword ?? hashPassword;
  const verifyHash = dependencies.verifyPassword ?? verifyPassword;
  const now = dependencies.now ?? (() => new Date());

  return (input: {
    userId: string;
    currentSessionId: string;
    currentPassword: string;
    newPassword: string;
  }) => dependencies.store.transaction(async (tx) => {
    const activation = await tx.lock(input.userId);
    if (!activation) throw new TenantActivationError("forbidden");
    if (!activation.passwordChangeRequired) return { ok: true } as const;

    const currentHash = await tx.getCredentialHash(input.userId);
    if (!currentHash || !(await verifyHash({ hash: currentHash, password: input.currentPassword }))) {
      return { ok: false, code: "invalid-current-password" } as const;
    }

    const replacementHash = await createHash(input.newPassword);
    await tx.replaceCredential(input.userId, replacementHash);
    await tx.revokeOtherSessions(input.userId, input.currentSessionId);
    await tx.completePasswordChange(input.userId, now());
    return { ok: true } as const;
  });
}

export function createResetTemporaryCredentialCommand(dependencies: {
  authorize: () => Promise<ProviderPrincipal>;
  store: TemporaryCredentialActivationStore;
  generateCredential?: () => string;
  hashPassword?: (password: string) => Promise<string>;
  now?: () => Date;
}) {
  const generateCredential = dependencies.generateCredential ?? (() => randomBytes(24).toString("base64url"));
  const createHash = dependencies.hashPassword ?? hashPassword;
  const now = dependencies.now ?? (() => new Date());

  return async (userId: string) => {
    await dependencies.authorize();
    return dependencies.store.transaction(async (tx) => {
      const activation = await tx.lock(userId);
      if (!activation) throw new TenantActivationError("forbidden");
      if (activation.firstAuthenticatedAt || !activation.passwordChangeRequired) {
        throw new TemporaryCredentialResetDeniedError();
      }

      const temporaryCredential = generateCredential();
      const credentialHash = await createHash(temporaryCredential);
      await tx.replaceCredential(userId, credentialHash);
      await tx.revokeAllSessions(userId);
      await tx.reissueTemporaryCredential(userId, now());
      return { ok: true, temporaryCredential } as const;
    });
  };
}
