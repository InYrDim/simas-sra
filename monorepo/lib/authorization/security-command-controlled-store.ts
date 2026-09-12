import {
  SecurityCommandError,
  type JsonValue,
  type SecurityActor,
  type SecurityContext,
  type SecurityPrincipal,
} from "@/lib/authorization/security-command";
import type {
  PersistedSecurityAuditEvent,
  PersistedSecurityCommand,
  PersistedSecurityOutbox,
  SecurityAuditHead,
  SecurityCommandStore,
  SecurityCommandTransactionStep,
  StoredSecurityCommand,
} from "@/lib/authorization/security-command-store";

export type ControlledSecurityRecord = Readonly<{
  id: string;
  version: number;
  value: JsonValue;
}>;

export type ControlledSecurityCommandTransaction = Readonly<{
  readState(id: string): Promise<ControlledSecurityRecord | null>;
  writeState(input: Readonly<{
    id: string;
    expectedVersion: number;
    value: JsonValue;
  }>): Promise<boolean>;
}>;

export type ControlledSecurityCommandSnapshot = Readonly<{
  state: readonly ControlledSecurityRecord[];
  commands: readonly StoredSecurityCommand[];
  auditEvents: readonly PersistedSecurityAuditEvent[];
  auditHeads: Readonly<Record<string, SecurityAuditHead>>;
  outbox: readonly PersistedSecurityOutbox[];
}>;

type MutableControlledState = {
  state: Map<string, ControlledSecurityRecord>;
  commands: Map<string, StoredSecurityCommand & { context: SecurityContext; idempotencyKey: string }>;
  auditEvents: PersistedSecurityAuditEvent[];
  auditHeads: Map<string, SecurityAuditHead>;
  outbox: PersistedSecurityOutbox[];
};

function cloneState(state: MutableControlledState): MutableControlledState {
  return {
    state: structuredClone(state.state),
    commands: structuredClone(state.commands),
    auditEvents: structuredClone(state.auditEvents),
    auditHeads: structuredClone(state.auditHeads),
    outbox: structuredClone(state.outbox),
  };
}

function partition(context: SecurityContext): string {
  return `${context.kind}:${context.contextId}`;
}

function commandKey(context: SecurityContext, idempotencyKey: string): string {
  return `${partition(context)}:${idempotencyKey}`;
}

export function createControlledSecurityCommandStore(options: Readonly<{
  actors: Readonly<Record<string, SecurityActor>>;
  providerContextId?: string;
  initialState?: readonly ControlledSecurityRecord[];
  failAfter?: SecurityCommandTransactionStep;
}>): Readonly<{
  store: SecurityCommandStore<ControlledSecurityCommandTransaction>;
  snapshot(): ControlledSecurityCommandSnapshot;
}> {
  let committed: MutableControlledState = {
    state: new Map((options.initialState ?? []).map((record) => [record.id, structuredClone(record)])),
    commands: new Map(),
    auditEvents: [],
    auditHeads: new Map(),
    outbox: [],
  };

  const store: SecurityCommandStore<ControlledSecurityCommandTransaction> = {
    async transaction(work) {
      const pending = cloneState(committed);
      const result = await work({
        async resolveActor(principal: SecurityPrincipal) {
          if (principal.kind === "system") return { kind: "system", service: principal.service };
          const actor = options.actors[principal.userId];
          if (!actor) return null;
          if (principal.kind === "support-recovery") {
            if (actor.kind !== "provider-admin" && actor.kind !== "support-recovery") return null;
            return {
              kind: "support-recovery",
              userId: actor.userId,
              displayName: actor.displayName,
              email: actor.email,
              recoveryCaseId: principal.recoveryCaseId,
            };
          }
          return actor;
        },
        async defaultContext(principal, actor) {
          if (principal.kind === "system") return principal.context;
          if (actor.kind === "tenant-user") {
            return { kind: "tenant", contextId: actor.tenantId, tenantId: actor.tenantId };
          }
          const contextId = options.providerContextId ?? "simas-provider";
          return { kind: "provider", contextId, providerContextId: contextId };
        },
        async findCommand(context, idempotencyKey) {
          const command = pending.commands.get(commandKey(context, idempotencyKey));
          return command ? structuredClone(command) : null;
        },
        async insertCommand(command: PersistedSecurityCommand) {
          const key = commandKey(command.context, command.idempotencyKey);
          if (pending.commands.has(key)) throw new SecurityCommandError("integrity-failure");
          pending.commands.set(key, {
            id: command.id,
            context: command.context,
            idempotencyKey: command.idempotencyKey,
            commandName: command.commandName,
            fingerprint: command.fingerprint,
            status: "pending",
            result: null,
          });
        },
        async lockAuditHead(context) {
          const key = partition(context);
          const head = pending.auditHeads.get(key) ?? {
            nextSequence: BigInt(1),
            headHash: "0".repeat(64),
            version: 1,
          };
          pending.auditHeads.set(key, head);
          return structuredClone(head);
        },
        async insertAuditEvents(events) {
          for (const event of events) {
            if (pending.auditEvents.some((candidate) =>
              partition(candidate.context) === partition(event.context)
              && (candidate.sequence === event.sequence || candidate.eventKey === event.eventKey))) {
              throw new SecurityCommandError("integrity-failure");
            }
            pending.auditEvents.push(structuredClone(event));
          }
        },
        async updateAuditHead(context, previous, next) {
          const key = partition(context);
          const current = pending.auditHeads.get(key);
          if (
            !current
            || current.version !== previous.version
            || current.nextSequence !== previous.nextSequence
            || current.headHash !== previous.headHash
          ) return false;
          pending.auditHeads.set(key, structuredClone(next));
          return true;
        },
        async insertOutbox(events) {
          for (const event of events) {
            if (pending.outbox.some((candidate) =>
              partition(candidate.context) === partition(event.context) && candidate.eventKey === event.eventKey)) {
              throw new SecurityCommandError("integrity-failure");
            }
            pending.outbox.push(structuredClone(event));
          }
        },
        async completeCommand(context, commandId, result) {
          const entry = [...pending.commands.entries()].find(([, command]) =>
            command.id === commandId && partition(command.context) === partition(context));
          if (!entry || entry[1].status !== "pending") throw new SecurityCommandError("integrity-failure");
          pending.commands.set(entry[0], { ...entry[1], status: "completed", result: structuredClone(result) });
        },
        async checkpoint(step) {
          if (options.failAfter === step) throw new Error(`Injected failure after ${step}`);
        },
        async readState(id) {
          const record = pending.state.get(id);
          return record ? structuredClone(record) : null;
        },
        async writeState(input) {
          const current = pending.state.get(input.id);
          if (!current || current.version !== input.expectedVersion) return false;
          pending.state.set(input.id, {
            id: input.id,
            version: input.expectedVersion + 1,
            value: structuredClone(input.value),
          });
          return true;
        },
      });
      committed = pending;
      return result;
    },
  };

  return {
    store,
    snapshot() {
      return {
        state: [...committed.state.values()].map((value) => structuredClone(value)),
        commands: [...committed.commands.values()].map((command) => structuredClone({
          id: command.id,
          commandName: command.commandName,
          fingerprint: command.fingerprint,
          status: command.status,
          result: command.result,
        })),
        auditEvents: structuredClone(committed.auditEvents),
        auditHeads: Object.fromEntries([...committed.auditHeads.entries()].map(([key, value]) => [key, structuredClone(value)])),
        outbox: structuredClone(committed.outbox),
      };
    },
  };
}
