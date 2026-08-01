import assert from "node:assert/strict";
import test from "node:test";

import {
  createControlledSecurityCommandStore,
  type ControlledSecurityCommandSnapshot,
  type ControlledSecurityCommandTransaction,
} from "@/lib/authorization/security-command-controlled-store";
import {
  createSecurityCommandService,
  SecurityCommandError,
  type SecurityActor,
} from "@/lib/authorization/security-command";
import type { PersistedSecurityAuditEvent } from "@/lib/authorization/security-command-store";
import {
  createSchoolAdminLifecycleService,
  SCHOOL_ADMIN_EVENT_TYPES,
  type LifecycleAuthorityRow,
  type LifecycleProofRow,
  type LifecycleUserRow,
  type SchoolAdminLifecycleRepository,
  type SchoolAdminLifecycleService,
} from "@/lib/authorization/school-admin-lifecycle";

const PROVIDER: Extract<SecurityActor, { kind: "provider-admin" }> = {
  kind: "provider-admin",
  userId: "provider-1",
  displayName: "Provider",
  email: "provider@simas.test",
};
const TENANT_USER: Extract<SecurityActor, { kind: "tenant-user" }> = {
  kind: "tenant-user",
  userId: "tenant-user-1",
  tenantId: "tenant-1",
  displayName: "Tenant User",
  email: "tenant@tenant-1.test",
};
const principal = { kind: "authenticated-user" as const, userId: PROVIDER.userId };
const tenantPrincipal = { kind: "authenticated-user" as const, userId: TENANT_USER.userId };
const SECRET = "test-proof-secret-01";

type StoredAuthority = Omit<LifecycleAuthorityRow, "legacyRole" | "accountLifecycle"> & { createdAt: Date };
type StoredProof = LifecycleProofRow & { idempotencyKey: string; createdAt: Date };

function duplicateKey(): Error {
  return Object.assign(new Error("Duplicate entry"), { errno: 1062 });
}

/**
 * In-memory stand-in for the MySQL repository. It enforces the same optimistic
 * versions and tenant-qualified unique constraints so the service's decisions
 * run against a faithful state machine.
 */
class FakeLifecycleRepository implements SchoolAdminLifecycleRepository {
  tenantExists = true;
  users = new Map<string, LifecycleUserRow & { email: string }>();
  authorities = new Map<string, StoredAuthority>();
  proofs = new Map<string, StoredProof>();
  lifecycle = new Map<string, "pending-activation" | "active" | "inactive">();
  sessions = new Map<string, { id: string; userId: string }>();

  async lockTenant(): Promise<boolean> {
    return this.tenantExists;
  }

  async loadUserByEmail(email: string): Promise<LifecycleUserRow | null> {
    for (const row of this.users.values()) {
      if (row.email === email) {
        return {
          id: row.id,
          tenantId: row.tenantId,
          tenantRole: row.tenantRole,
          providerAdmin: row.providerAdmin,
          applicant: row.applicant,
        };
      }
    }
    return null;
  }

  async listAuthorities(tenantId: string): Promise<readonly LifecycleAuthorityRow[]> {
    return [...this.authorities.values()]
      .filter((row) => row.tenantId === tenantId && this.users.get(row.userId)?.tenantId === tenantId)
      .sort((left, right) => left.userId.localeCompare(right.userId))
      .map((row) => ({
        id: row.id,
        tenantId: row.tenantId,
        userId: row.userId,
        authorityState: row.authorityState,
        version: row.version,
        grantedAt: row.grantedAt,
        disabledAt: row.disabledAt,
        legacyRole: this.users.get(row.userId)?.tenantRole ?? null,
        accountLifecycle: this.lifecycle.get(row.userId) ?? null,
      }));
  }

  async insertAuthority(input: Readonly<{ id: string; tenantId: string; userId: string; createdAt: Date }>): Promise<void> {
    if ([...this.authorities.values()].some((row) =>
      row.tenantId === input.tenantId && row.userId === input.userId)) {
      throw duplicateKey();
    }
    this.authorities.set(input.id, {
      id: input.id,
      tenantId: input.tenantId,
      userId: input.userId,
      authorityState: "none",
      version: 1,
      grantedAt: null,
      disabledAt: null,
      createdAt: input.createdAt,
    });
  }

  async updateAuthority(input: Readonly<{
    id: string;
    tenantId: string;
    expectedVersion: number;
    authorityState: LifecycleAuthorityRow["authorityState"];
    grantedAt: Date | null;
    disabledAt: Date | null;
    updatedAt: Date;
  }>): Promise<boolean> {
    const row = this.authorities.get(input.id);
    if (!row || row.tenantId !== input.tenantId || row.version !== input.expectedVersion) return false;
    this.authorities.set(input.id, {
      ...row,
      authorityState: input.authorityState,
      grantedAt: input.grantedAt,
      disabledAt: input.disabledAt,
      version: input.expectedVersion + 1,
    });
    return true;
  }

  async loadProofByCaseId(tenantId: string, caseId: string): Promise<LifecycleProofRow | null> {
    for (const row of this.proofs.values()) {
      if (row.tenantId === tenantId && row.caseId === caseId) return this.stripProof(row);
    }
    return null;
  }

  async listProofsByAuthority(tenantId: string, authorityId: string): Promise<readonly LifecycleProofRow[]> {
    return [...this.proofs.values()]
      .filter((row) => row.tenantId === tenantId && row.authorityId === authorityId)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .map((row) => this.stripProof(row));
  }

  async insertProof(input: Readonly<{
    id: string;
    tenantId: string;
    authorityId: string;
    caseId: string;
    kind: LifecycleProofRow["kind"];
    proofState: "pending";
    secretDigest: string;
    expiresAt: Date;
    version: number;
    idempotencyKey: string;
    createdAt: Date;
  }>): Promise<void> {
    for (const row of this.proofs.values()) {
      if (row.tenantId === input.tenantId && row.caseId === input.caseId) throw duplicateKey();
      if (row.tenantId === input.tenantId && row.idempotencyKey === input.idempotencyKey) throw duplicateKey();
      if (
        row.tenantId === input.tenantId
        && row.authorityId === input.authorityId
        && row.kind === input.kind
        && row.proofState === "pending"
      ) throw duplicateKey();
    }
    this.proofs.set(input.id, {
      id: input.id,
      tenantId: input.tenantId,
      authorityId: input.authorityId,
      caseId: input.caseId,
      kind: input.kind,
      proofState: input.proofState,
      secretDigest: input.secretDigest,
      expiresAt: input.expiresAt,
      completedAt: null,
      version: input.version,
      idempotencyKey: input.idempotencyKey,
      createdAt: input.createdAt,
    });
  }

  async updateProof(input: Readonly<{
    id: string;
    tenantId: string;
    expectedVersion: number;
    proofState: LifecycleProofRow["proofState"];
    secretDigest?: string | null;
    expiresAt?: Date | null;
    completedAt?: Date | null;
    updatedAt: Date;
  }>): Promise<boolean> {
    const row = this.proofs.get(input.id);
    if (!row || row.tenantId !== input.tenantId || row.version !== input.expectedVersion) return false;
    const next: StoredProof = {
      ...row,
      proofState: input.proofState,
      version: input.expectedVersion + 1,
      ...(input.secretDigest !== undefined ? { secretDigest: input.secretDigest } : {}),
      ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
      ...(input.completedAt !== undefined ? { completedAt: input.completedAt } : {}),
    };
    this.proofs.set(input.id, next);
    return true;
  }

  async setUserTenantRole(input: Readonly<{
    userId: string;
    tenantId: string;
    tenantRole: "school-admin" | null;
  }>): Promise<boolean> {
    const account = this.users.get(input.userId);
    if (!account || account.tenantId !== input.tenantId) return false;
    if (input.tenantRole === null && account.tenantRole !== "school-admin") return false;
    this.users.set(input.userId, { ...account, tenantRole: input.tenantRole });
    return true;
  }

  async revokeSessions(userId: string): Promise<number> {
    let count = 0;
    for (const [id, session] of this.sessions) {
      if (session.userId === userId) {
        this.sessions.delete(id);
        count += 1;
      }
    }
    return count;
  }

  private stripProof(row: StoredProof): LifecycleProofRow {
    return {
      id: row.id,
      tenantId: row.tenantId,
      authorityId: row.authorityId,
      caseId: row.caseId,
      kind: row.kind,
      proofState: row.proofState,
      secretDigest: row.secretDigest,
      expiresAt: row.expiresAt,
      completedAt: row.completedAt,
      version: row.version,
    };
  }
}

type Fixture = Readonly<{
  controlled: ReturnType<typeof createControlledSecurityCommandStore>;
  repository: FakeLifecycleRepository;
  service: SchoolAdminLifecycleService;
  now: () => Date;
}>;

function fixture(options: { secrets?: string[]; clock?: Date } = {}): Fixture {
  const clock = { value: options.clock ?? new Date("2026-07-31T10:00:00.000Z") };
  const now = () => clock.value;
  const controlled = createControlledSecurityCommandStore({
    actors: { [PROVIDER.userId]: PROVIDER, [TENANT_USER.userId]: TENANT_USER },
  });
  const execute = createSecurityCommandService<ControlledSecurityCommandTransaction>({
    store: controlled.store,
    now,
    reportSecuritySignal: () => undefined,
  });
  const repository = new FakeLifecycleRepository();
  const secrets = [...(options.secrets ?? [SECRET])];
  let secretIndex = 0;
  const service = createSchoolAdminLifecycleService<ControlledSecurityCommandTransaction>({
    execute,
    repository: () => repository,
    generateSecret: () => secrets[Math.min(secretIndex++, secrets.length - 1)] ?? SECRET,
    now,
  });
  return { controlled, repository, service, now };
}

function seedUser(
  repository: FakeLifecycleRepository,
  input: Readonly<{ id: string; tenantId: string | null; tenantRole: string | null; email: string }>,
): void {
  repository.users.set(input.id, {
    id: input.id,
    tenantId: input.tenantId,
    tenantRole: input.tenantRole,
    providerAdmin: false,
    applicant: false,
    email: input.email,
  });
}

/** Seeds one active incumbent School Admin with a session so coverage exists. */
function seedTenant(repository: FakeLifecycleRepository, tenantId = "tenant-1"): void {
  seedUser(repository, { id: "incumbent-1", tenantId, tenantRole: "school-admin", email: "incumbent@tenant-1.test" });
  repository.authorities.set("authority-incumbent", {
    id: "authority-incumbent",
    tenantId,
    userId: "incumbent-1",
    authorityState: "active",
    version: 1,
    grantedAt: new Date("2026-07-01T00:00:00.000Z"),
    disabledAt: null,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
  });
  repository.lifecycle.set("incumbent-1", "active");
  repository.sessions.set("session-incumbent-1", { id: "session-incumbent-1", userId: "incumbent-1" });
}

function authority(repository: FakeLifecycleRepository, id: string): StoredAuthority | undefined {
  return repository.authorities.get(id);
}

function eventsByCorrelation(
  snapshot: ControlledSecurityCommandSnapshot,
  correlationId: string,
): readonly PersistedSecurityAuditEvent[] {
  return snapshot.auditEvents.filter((event) => event.correlationId === correlationId);
}

test("account-control proof never grants authority; only the separate grant command does", async () => {
  const { controlled, repository, service } = fixture();
  seedTenant(repository);
  seedUser(repository, { id: "nominee-1", tenantId: "tenant-1", tenantRole: "staff", email: "nominee@tenant-1.test" });

  const nomination = await service.nominateSchoolAdmin({
    principal,
    tenantId: "tenant-1",
    email: "nominee@tenant-1.test",
    reason: "Menambah admin sekolah",
    caseId: "case-nomination-1",
    idempotencyKey: "nominate-1-key",
    correlationId: "corr-1",
  });
  assert.equal(nomination.status, "nomination-created");
  assert.equal(nomination.replacement, false);
  assert.equal(nomination.proofState, "pending");

  const proof = await service.completeAccountControlProof({
    principal,
    tenantId: "tenant-1",
    caseId: nomination.caseId,
    expectedProofVersion: 1,
    secret: SECRET,
    idempotencyKey: "complete-proof-1",
    correlationId: "corr-1",
  });
  assert.equal(proof.status, "proof-completed");
  assert.equal(proof.authorityState, "none");
  assert.equal(authority(repository, nomination.authorityId)?.authorityState, "none");
  assert.equal(authority(repository, nomination.authorityId)?.version, 1);

  const granted = await service.grantSchoolAdminAuthority({
    principal,
    tenantId: "tenant-1",
    caseId: nomination.caseId,
    authorityId: nomination.authorityId,
    expectedAuthorityVersion: 1,
    expectedProofVersion: 2,
    reason: "Verifikasi selesai",
    idempotencyKey: "grant-1-key",
    correlationId: "corr-1",
  });
  assert.equal(granted.status, "granted");
  assert.equal(granted.activeCount, 2);
  assert.equal(authority(repository, nomination.authorityId)?.authorityState, "active");
  assert.equal(repository.users.get("nominee-1")?.tenantRole, "school-admin");

  const events = eventsByCorrelation(controlled.snapshot(), "corr-1");
  assert.deepEqual(events.map((event) => event.eventType), [
    SCHOOL_ADMIN_EVENT_TYPES.NOMINATION_CREATED,
    SCHOOL_ADMIN_EVENT_TYPES.ACCOUNT_CONTROL_PROOF_COMPLETED,
    SCHOOL_ADMIN_EVENT_TYPES.AUTHORITY_GRANTED,
  ]);
});

test("replacement cutover atomically grants the successor, disables only the incumbent, revokes sessions, and writes three linked events", async () => {
  const { controlled, repository, service } = fixture();
  seedTenant(repository);
  seedUser(repository, { id: "other-1", tenantId: "tenant-1", tenantRole: "school-admin", email: "other@tenant-1.test" });
  repository.authorities.set("authority-other", {
    id: "authority-other",
    tenantId: "tenant-1",
    userId: "other-1",
    authorityState: "active",
    version: 1,
    grantedAt: new Date("2026-07-01T00:00:00.000Z"),
    disabledAt: null,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
  });
  repository.lifecycle.set("other-1", "active");
  seedUser(repository, { id: "successor-1", tenantId: "tenant-1", tenantRole: "staff", email: "successor@tenant-1.test" });
  repository.sessions.set("session-incumbent-2", { id: "session-incumbent-2", userId: "incumbent-1" });

  const nomination = await service.nominateSchoolAdmin({
    principal,
    tenantId: "tenant-1",
    email: "successor@tenant-1.test",
    reason: "Serah terima penanggung jawab",
    caseId: "case-replacement-1",
    incumbentAuthorityId: "authority-incumbent",
    idempotencyKey: "replacement-nom",
    correlationId: "corr-replacement",
  });
  assert.equal(nomination.replacement, true);
  await service.completeAccountControlProof({
    principal,
    tenantId: "tenant-1",
    caseId: nomination.caseId,
    expectedProofVersion: 1,
    secret: SECRET,
    idempotencyKey: "replacement-proof",
    correlationId: "corr-replacement",
  });

  const cutover = await service.completeSchoolAdminReplacement({
    principal,
    tenantId: "tenant-1",
    caseId: nomination.caseId,
    successorAuthorityId: nomination.authorityId,
    successorExpectedVersion: 1,
    incumbentAuthorityId: "authority-incumbent",
    incumbentExpectedVersion: 1,
    expectedProofVersion: 2,
    reason: "Serah terima penanggung jawab selesai",
    idempotencyKey: "replacement-cut",
    correlationId: "corr-replacement",
  });
  assert.equal(cutover.status, "cutover-completed");
  assert.equal(cutover.activeCount, 2);

  assert.equal(authority(repository, nomination.authorityId)?.authorityState, "active");
  assert.equal(authority(repository, "authority-incumbent")?.authorityState, "disabled");
  assert.equal(authority(repository, "authority-other")?.authorityState, "active");
  assert.equal(repository.users.get("successor-1")?.tenantRole, "school-admin");
  assert.equal(repository.users.get("incumbent-1")?.tenantRole, null);
  assert.equal(
    [...repository.sessions.values()].filter((session) => session.userId === "incumbent-1").length,
    0,
  );

  const events = eventsByCorrelation(controlled.snapshot(), "corr-replacement");
  const cutoverTypes: readonly string[] = [
    SCHOOL_ADMIN_EVENT_TYPES.AUTHORITY_DISABLED,
    SCHOOL_ADMIN_EVENT_TYPES.AUTHORITY_GRANTED,
    SCHOOL_ADMIN_EVENT_TYPES.REPLACEMENT_CUTOVER_COMPLETED,
  ];
  const cutoverEvents = events.filter((event) => cutoverTypes.includes(event.eventType));
  assert.equal(cutoverEvents.length, 3);
  const types = cutoverEvents.map((event) => event.eventType).sort();
  assert.deepEqual(types, [...cutoverTypes].sort());
  for (const event of events) {
    const details = (event.metadata as { details?: { caseId?: string } }).details ?? {};
    assert.equal(details.caseId, nomination.caseId);
  }
  const parent = cutoverEvents.find((event) =>
    event.eventType === SCHOOL_ADMIN_EVENT_TYPES.REPLACEMENT_CUTOVER_COMPLETED);
  assert.ok(parent);
  const parentDetails = (parent.metadata as { details?: Record<string, unknown> }).details ?? {};
  assert.equal(parentDetails.successorAuthorityId, nomination.authorityId);
  assert.equal(parentDetails.incumbentAuthorityId, "authority-incumbent");
  assert.equal(parentDetails.successorAuthorityStateAfter, "active");
  assert.equal(parentDetails.incumbentAuthorityStateAfter, "disabled");
});

test("disable is blocked when the target is the last active School Admin", async () => {
  const { repository, service } = fixture();
  seedTenant(repository);
  await assert.rejects(
    service.disableSchoolAdminAuthority({
      principal,
      tenantId: "tenant-1",
      authorityId: "authority-incumbent",
      expectedVersion: 1,
      reason: "Mengosongkan cakupan",
      idempotencyKey: "disable-last-1",
      correlationId: "corr-3",
    }),
    (error: unknown) => error instanceof SecurityCommandError && error.code === "integrity-failure",
  );
  assert.equal(authority(repository, "authority-incumbent")?.authorityState, "active");
});

test("multiple active School Admins are supported and each disable keeps coverage intact", async () => {
  const { repository, service } = fixture();
  seedTenant(repository);
  seedUser(repository, { id: "second-1", tenantId: "tenant-1", tenantRole: "school-admin", email: "second@tenant-1.test" });
  repository.authorities.set("authority-second", {
    id: "authority-second",
    tenantId: "tenant-1",
    userId: "second-1",
    authorityState: "active",
    version: 1,
    grantedAt: new Date("2026-07-01T00:00:00.000Z"),
    disabledAt: null,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
  });
  repository.lifecycle.set("second-1", "active");

  const disabled = await service.disableSchoolAdminAuthority({
    principal,
    tenantId: "tenant-1",
    authorityId: "authority-incumbent",
    expectedVersion: 1,
    reason: "Pengurangan admin",
    idempotencyKey: "disable-one-1",
    correlationId: "corr-4",
  });
  assert.deepEqual(disabled, { status: "disabled", remainingActive: 1 });
  assert.equal(authority(repository, "authority-incumbent")?.authorityState, "disabled");

  await assert.rejects(
    service.disableSchoolAdminAuthority({
      principal,
      tenantId: "tenant-1",
      authorityId: "authority-second",
      expectedVersion: 1,
      reason: "Admin terakhir",
      idempotencyKey: "disable-last-2",
      correlationId: "corr-4",
    }),
    (error: unknown) => error instanceof SecurityCommandError && error.code === "integrity-failure",
  );
  assert.equal(authority(repository, "authority-second")?.authorityState, "active");
});

test("recovery proof never reactivates authority; a separate reauthenticated command does", async () => {
  const { repository, service } = fixture();
  seedUser(repository, { id: "recovered-1", tenantId: "tenant-1", tenantRole: null, email: "recovered@tenant-1.test" });
  repository.authorities.set("authority-recovered", {
    id: "authority-recovered",
    tenantId: "tenant-1",
    userId: "recovered-1",
    authorityState: "disabled",
    version: 3,
    grantedAt: new Date("2026-06-01T00:00:00.000Z"),
    disabledAt: new Date("2026-07-01T00:00:00.000Z"),
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
  });

  const started = await service.startSchoolAdminRecovery({
    principal,
    tenantId: "tenant-1",
    authorityId: "authority-recovered",
    expectedAuthorityVersion: 3,
    reason: "Pemulihan akses",
    idempotencyKey: "recovery-start",
    correlationId: "corr-5",
  });
  assert.equal(started.status, "recovery-started");
  assert.equal(started.proofState, "pending");

  const proof = await service.completeRecoveryProof({
    principal,
    tenantId: "tenant-1",
    caseId: started.caseId,
    expectedProofVersion: 1,
    secret: SECRET,
    idempotencyKey: "recovery-proof-1",
    correlationId: "corr-5",
  });
  assert.equal(proof.status, "proof-completed");
  assert.equal(proof.authorityState, "disabled");
  assert.equal(authority(repository, "authority-recovered")?.authorityState, "disabled");

  const reactivated = await service.reactivateSchoolAdminAuthority({
    principal,
    tenantId: "tenant-1",
    caseId: started.caseId,
    authorityId: "authority-recovered",
    expectedAuthorityVersion: 3,
    expectedProofVersion: 2,
    reason: "Pemulihan selesai",
    idempotencyKey: "reactivate-1",
    correlationId: "corr-5",
  });
  assert.equal(reactivated.status, "reactivated");
  assert.equal(authority(repository, "authority-recovered")?.authorityState, "active");
  assert.equal(repository.users.get("recovered-1")?.tenantRole, "school-admin");
});

test("Tenant users cannot invoke Provider-owned mutations but may prove control of their own nomination", async () => {
  const { repository, service } = fixture();
  seedTenant(repository);
  seedUser(repository, { id: "nominee-2", tenantId: "tenant-1", tenantRole: "staff", email: "nominee2@tenant-1.test" });
  const reason = "Diblokir untuk pengguna tenant";
  const attempts = [
    () => service.nominateSchoolAdmin({
      principal: tenantPrincipal, tenantId: "tenant-1", email: "nominee2@tenant-1.test", reason,
      caseId: "case-tenant-nom", idempotencyKey: "tenant-nom-1", correlationId: "corr-6",
    }),
    () => service.grantSchoolAdminAuthority({
      principal: tenantPrincipal, tenantId: "tenant-1", caseId: "case-tenant-grant",
      authorityId: "authority-incumbent", expectedAuthorityVersion: 1, expectedProofVersion: 1, reason,
      idempotencyKey: "tenant-grant-1", correlationId: "corr-6",
    }),
    () => service.disableSchoolAdminAuthority({
      principal: tenantPrincipal, tenantId: "tenant-1", authorityId: "authority-incumbent",
      expectedVersion: 1, reason, idempotencyKey: "tenant-disable", correlationId: "corr-6",
    }),
    () => service.completeSchoolAdminReplacement({
      principal: tenantPrincipal, tenantId: "tenant-1", caseId: "case-tenant-replace",
      successorAuthorityId: "authority-successor", successorExpectedVersion: 1,
      incumbentAuthorityId: "authority-incumbent", incumbentExpectedVersion: 1,
      expectedProofVersion: 1, reason, idempotencyKey: "tenant-replace", correlationId: "corr-6",
    }),
    () => service.startSchoolAdminRecovery({
      principal: tenantPrincipal, tenantId: "tenant-1", authorityId: "authority-incumbent",
      expectedAuthorityVersion: 1, reason, idempotencyKey: "tenant-recover", correlationId: "corr-6",
    }),
    () => service.reactivateSchoolAdminAuthority({
      principal: tenantPrincipal, tenantId: "tenant-1", caseId: "case-tenant-react",
      authorityId: "authority-incumbent", expectedAuthorityVersion: 1, expectedProofVersion: 1, reason,
      idempotencyKey: "tenant-react-1", correlationId: "corr-6",
    }),
  ];
  for (const attempt of attempts) {
    await assert.rejects(attempt(), (error: unknown) =>
      error instanceof SecurityCommandError && error.code === "context-denied");
  }

  const nomination = await service.nominateSchoolAdmin({
    principal,
    tenantId: "tenant-1",
    email: "nominee2@tenant-1.test",
    reason,
    caseId: "case-tenant-proof",
    idempotencyKey: "nominee-proof-1",
    correlationId: "corr-6",
  });
  const completed = await service.completeAccountControlProof({
    principal: tenantPrincipal,
    tenantId: "tenant-1",
    caseId: nomination.caseId,
    expectedProofVersion: 1,
    secret: SECRET,
    idempotencyKey: "tenant-proof-1",
    correlationId: "corr-6",
  });
  assert.equal(completed.status, "proof-completed");
  assert.equal(completed.authorityState, "none");
});

test("nomination never reveals whether an email belongs to another Tenant, a privileged context, or nobody", async () => {
  const { repository, service } = fixture();
  seedTenant(repository);
  seedUser(repository, { id: "foreign-1", tenantId: "tenant-2", tenantRole: "school-admin", email: "foreign@tenant-2.test" });
  repository.users.set("provider-1", {
    id: "provider-1", tenantId: null, tenantRole: null, providerAdmin: true, applicant: false,
    email: "provider@simas.test",
  });
  repository.users.set("applicant-1", {
    id: "applicant-1", tenantId: null, tenantRole: null, providerAdmin: false, applicant: true,
    email: "applicant@simas.test",
  });

  const emails = [
    "foreign@tenant-2.test", // another Tenant's user
    "provider@simas.test", // Provider Admin
    "applicant@simas.test", // Applicant
    "incumbent@tenant-1.test", // already on this Tenant's roster
    "nonexistent-9f3k@random.test", // never existed
  ];
  const denials: SecurityCommandError[] = [];
  for (const [index, email] of emails.entries()) {
    try {
      await service.nominateSchoolAdmin({
        principal,
        tenantId: "tenant-1",
        email,
        reason: "Uji enumerasi",
        caseId: `case-diff-${index}`,
        idempotencyKey: `diff-email-${index + 1}`,
        correlationId: "corr-7",
      });
      assert.fail(`expected context-denied for ${email}`);
    } catch (error) {
      assert.ok(error instanceof SecurityCommandError, `unexpected error for ${email}`);
      denials.push(error);
    }
  }
  for (const error of denials) {
    assert.equal(error.code, "context-denied");
    assert.equal(error.message, "context-denied");
  }
});

test("stale optimistic versions reject with stale-version", async () => {
  const { repository, service } = fixture();
  seedTenant(repository);
  seedUser(repository, { id: "nominee-3", tenantId: "tenant-1", tenantRole: "staff", email: "nominee3@tenant-1.test" });
  const nomination = await service.nominateSchoolAdmin({
    principal,
    tenantId: "tenant-1",
    email: "nominee3@tenant-1.test",
    reason: "Uji versi",
    caseId: "case-version-1",
    idempotencyKey: "version-nom-1",
    correlationId: "corr-8",
  });
  await service.completeAccountControlProof({
    principal,
    tenantId: "tenant-1",
    caseId: nomination.caseId,
    expectedProofVersion: 1,
    secret: SECRET,
    idempotencyKey: "version-proof-1",
    correlationId: "corr-8",
  });

  await assert.rejects(
    service.grantSchoolAdminAuthority({
      principal,
      tenantId: "tenant-1",
      caseId: nomination.caseId,
      authorityId: nomination.authorityId,
      expectedAuthorityVersion: 99,
      expectedProofVersion: 2,
      reason: "Versi salah",
      idempotencyKey: "version-grant-1",
      correlationId: "corr-8",
    }),
    (error: unknown) => error instanceof SecurityCommandError && error.code === "stale-version",
  );
  await assert.rejects(
    service.grantSchoolAdminAuthority({
      principal,
      tenantId: "tenant-1",
      caseId: nomination.caseId,
      authorityId: nomination.authorityId,
      expectedAuthorityVersion: 1,
      expectedProofVersion: 99,
      reason: "Versi salah",
      idempotencyKey: "version-grant-2",
      correlationId: "corr-8",
    }),
    (error: unknown) => error instanceof SecurityCommandError && error.code === "stale-version",
  );
  assert.equal(authority(repository, nomination.authorityId)?.authorityState, "none");
});

test("replaying a command with the same idempotency key replays the result without duplicates", async () => {
  const { controlled, repository, service } = fixture();
  seedTenant(repository);
  seedUser(repository, { id: "nominee-4", tenantId: "tenant-1", tenantRole: "staff", email: "nominee4@tenant-1.test" });
  const input = {
    principal,
    tenantId: "tenant-1",
    email: "nominee4@tenant-1.test",
    reason: "Uji idempotensi",
    caseId: "case-idem-1",
    idempotencyKey: "idem-nominate-1",
    correlationId: "corr-9",
  };
  const first = await service.nominateSchoolAdmin(input);
  const replay = await service.nominateSchoolAdmin({ ...input, correlationId: "corr-9b" });
  assert.deepEqual(replay, first);
  assert.equal(
    [...repository.authorities.values()].filter((row) => row.tenantId === "tenant-1").length,
    2,
  );
  assert.equal(repository.proofs.size, 1);
  assert.equal(eventsByCorrelation(controlled.snapshot(), "corr-9").length, 1);
});

test("resending proof rotates the secret and invalidates the previous secret", async () => {
  const { repository, service } = fixture({ secrets: [SECRET, "rotated-secret-02"] });
  seedTenant(repository);
  seedUser(repository, { id: "nominee-5", tenantId: "tenant-1", tenantRole: "staff", email: "nominee5@tenant-1.test" });
  const nomination = await service.nominateSchoolAdmin({
    principal,
    tenantId: "tenant-1",
    email: "nominee5@tenant-1.test",
    reason: "Uji rotasi",
    caseId: "case-rotate-1",
    idempotencyKey: "rotate-nom-1",
    correlationId: "corr-10",
  });
  const rotated = await service.resendProofSecret({
    principal,
    tenantId: "tenant-1",
    caseId: nomination.caseId,
    expectedProofVersion: 1,
    reason: "Kirim ulang",
    idempotencyKey: "rotate-resend-1",
    correlationId: "corr-10",
  });
  assert.equal(rotated.status, "secret-rotated");
  assert.equal(rotated.proofState, "pending");

  await assert.rejects(
    service.completeAccountControlProof({
      principal,
      tenantId: "tenant-1",
      caseId: nomination.caseId,
      expectedProofVersion: 2,
      secret: SECRET,
      idempotencyKey: "rotate-old-1",
      correlationId: "corr-10",
    }),
    (error: unknown) => error instanceof SecurityCommandError && error.code === "context-denied",
  );
  const completed = await service.completeAccountControlProof({
    principal,
    tenantId: "tenant-1",
    caseId: nomination.caseId,
    expectedProofVersion: 2,
    secret: "rotated-secret-02",
    idempotencyKey: "rotate-new-1",
    correlationId: "corr-10",
  });
  assert.equal(completed.status, "proof-completed");
});

test("an expired proof cannot be completed", async () => {
  const clock = new Date("2026-07-31T10:00:00.000Z");
  const { repository, service } = fixture({ clock });
  seedTenant(repository);
  seedUser(repository, { id: "nominee-6", tenantId: "tenant-1", tenantRole: "staff", email: "nominee6@tenant-1.test" });
  const nomination = await service.nominateSchoolAdmin({
    principal,
    tenantId: "tenant-1",
    email: "nominee6@tenant-1.test",
    reason: "Uji kedaluwarsa",
    caseId: "case-expire-1",
    idempotencyKey: "expire-nom-1",
    correlationId: "corr-11",
  });
  clock.setTime(clock.getTime() + 73 * 60 * 60 * 1000);
  await assert.rejects(
    service.completeAccountControlProof({
      principal,
      tenantId: "tenant-1",
      caseId: nomination.caseId,
      expectedProofVersion: 1,
      secret: SECRET,
      idempotencyKey: "expire-proof-1",
      correlationId: "corr-11",
    }),
    (error: unknown) => error instanceof SecurityCommandError && error.code === "context-denied",
  );
});
