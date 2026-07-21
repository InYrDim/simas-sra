import type { PpdbFormField } from "@/lib/ppdb-session";
import type { SchoolAssetStorage } from "@/lib/school-profile-assets";
import type { MasterDataPrincipal } from "@/lib/tenant-master-data-access";

export type PpdbSubmissionStatus = "pending" | "accepted" | "rejected";
export type PpdbSubmission = Readonly<{
  id: string;
  tenantId: string;
  sessionId: string;
  registrationCode: string;
  studentName: string;
  nisn: string;
  status: PpdbSubmissionStatus;
  score: number | null;
  formFields: readonly PpdbFormField[];
  formData: Readonly<Record<string, unknown>>;
  documents: readonly PpdbSubmissionDocument[];
  version: number;
  submittedAt: Date;
  updatedAt: Date;
}>;
export type PpdbSubmissionDocument = Readonly<{
  id: string;
  tenantId: string;
  submissionId: string;
  fieldId: string;
  storageKey: string;
  originalFileName: string;
  mimeType: "application/pdf" | "image/jpeg" | "image/png";
  byteSize: number;
  createdAt: Date;
}>;
export type PpdbSubmissionDocumentInput = Readonly<{
  fieldId: string;
  originalFileName: string;
  mimeType: PpdbSubmissionDocument["mimeType"];
  extension: "pdf" | "jpg" | "png";
  bytes: Uint8Array;
}>;
export type PpdbSubmissionInput = Readonly<{ studentName: string; nisn: string; formData: Readonly<Record<string, unknown>> }>;
export type PpdbPublishedSession = Readonly<{ id: string; fields: readonly PpdbFormField[] }>;

export interface PpdbSubmissionStore {
  findPublishedSession(tenantId: string, sessionId: string): Promise<PpdbPublishedSession | null>;
  createSubmission(
    submission: PpdbSubmission,
    documents?: readonly PpdbSubmissionDocument[],
  ): Promise<{ ok: true } | { ok: false; code: "duplicate-code" }>;
  findByRegistrationCode(tenantId: string, registrationCode: string): Promise<PpdbSubmission | null>;
  findById(tenantId: string, submissionId: string): Promise<PpdbSubmission | null>;
  list(tenantId: string, sessionId?: string): Promise<PpdbSubmission[]>;
  findDocument(tenantId: string, submissionId: string, documentId: string): Promise<PpdbSubmissionDocument | null>;
  applyDecision(
    tenantId: string,
    submissionId: string,
    expectedVersion: number,
    patch: Readonly<{ status: "accepted" | "rejected"; score: number | null; updatedAt: Date }>,
  ): Promise<boolean>;
}

type SubmitFailure = { ok: false; code: "session-not-open" | "invalid-input" | "registration-code-exhausted" };
type DecideFailure = { ok: false; code: "not-found" | "conflict" };

function requiredFieldsSatisfied(
  input: PpdbSubmissionInput,
  fields: readonly PpdbFormField[],
  nisnRequired: boolean,
  documents: readonly PpdbSubmissionDocumentInput[],
) {
  if (!input.studentName.trim() || (nisnRequired && !input.nisn.trim())) return false;
  return fields.filter((field) => field.required).every((field) => {
    if (field.type === "file") return documents.some((document) => document.fieldId === field.id);
    const value = input.formData[field.id];
    return value !== undefined && value !== null && String(value).trim() !== "";
  });
}

export function createPpdbSubmissionService(dependencies: {
  store: PpdbSubmissionStore;
  storage?: SchoolAssetStorage;
  id?: () => string;
  now?: () => Date;
  randomCode?: () => string;
}) {
  const id = dependencies.id ?? (() => crypto.randomUUID());
  const now = dependencies.now ?? (() => new Date());
  const randomCode = dependencies.randomCode ?? (() => crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase());

  function generateRegistrationCode(timestamp: Date) {
    return `PPDB-${timestamp.getUTCFullYear()}-${randomCode()}`;
  }

  return {
    // Anonim: Calon Siswa mengisi tanpa akun. Hanya menerima isian untuk Sesi yang sedang "published".
    async submit(
      tenantId: string,
      sessionId: string,
      input: PpdbSubmissionInput,
      options: Readonly<{
        nisnRequired: boolean;
        documents?: readonly PpdbSubmissionDocumentInput[];
      }> = { nisnRequired: true },
    ): Promise<{ ok: true; registrationCode: string } | SubmitFailure> {
      const session = await dependencies.store.findPublishedSession(tenantId, sessionId);
      if (!session?.fields.length) return { ok: false, code: "session-not-open" };
      const documentInputs = options.documents ?? [];
      if (!requiredFieldsSatisfied(input, session.fields, options.nisnRequired, documentInputs)) return { ok: false, code: "invalid-input" };
      if (documentInputs.length && !dependencies.storage) throw new Error("PPDB document storage unavailable");
      const timestamp = now();
      for (let attempt = 0; attempt < 5; attempt++) {
        const submissionId = id();
        const documents = documentInputs.map((document): PpdbSubmissionDocument => {
          const documentId = id();
          return {
            id: documentId,
            tenantId,
            submissionId,
            fieldId: document.fieldId,
            storageKey: `tenants/${tenantId}/ppdb/${submissionId}/${documentId}.${document.extension}`,
            originalFileName: document.originalFileName,
            mimeType: document.mimeType,
            byteSize: document.bytes.byteLength,
            createdAt: timestamp,
          };
        });
        const submission: PpdbSubmission = {
          id: submissionId,
          tenantId,
          sessionId,
          registrationCode: generateRegistrationCode(timestamp),
          studentName: input.studentName.trim(),
          nisn: input.nisn.trim(),
          status: "pending",
          score: null,
          formFields: structuredClone(session.fields),
          formData: input.formData,
          documents,
          version: 1,
          submittedAt: timestamp,
          updatedAt: timestamp,
        };
        const writtenKeys: string[] = [];
        try {
          for (let index = 0; index < documents.length; index++) {
            const document = documents[index];
            await dependencies.storage!.write(tenantId, document.storageKey, documentInputs[index].bytes);
            writtenKeys.push(document.storageKey);
          }
          const result = await dependencies.store.createSubmission(submission, documents);
          if (result.ok) return { ok: true, registrationCode: submission.registrationCode };
        } finally {
          if (documents.length) {
            const persisted = await dependencies.store.findById(tenantId, submissionId);
            if (!persisted) await Promise.all(writtenKeys.map((key) => dependencies.storage!.remove(tenantId, key)));
          }
        }
      }
      return { ok: false, code: "registration-code-exhausted" };
    },

    // Cek status publik pakai ID pendaftaran + NISN — tanpa login.
    async checkStatus(
      tenantId: string,
      registrationCode: string,
      nisn: string,
      options: Readonly<{ nisnRequired: boolean }> = { nisnRequired: true },
    ) {
      const submission = await dependencies.store.findByRegistrationCode(tenantId, registrationCode.trim().toUpperCase());
      const submittedNisn = nisn.trim();
      if (!submission || (options.nisnRequired && submission.nisn !== submittedNisn)) {
        return { ok: false, code: "not-found" } as const;
      }
      return { ok: true, studentName: submission.studentName, status: submission.status, score: submission.score } as const;
    },

    list(principal: MasterDataPrincipal, sessionId?: string) {
      return dependencies.store.list(principal.tenantId, sessionId);
    },

    findDocument(principal: MasterDataPrincipal, submissionId: string, documentId: string) {
      return dependencies.store.findDocument(principal.tenantId, submissionId, documentId);
    },

    // Terima/tolak/skor tetap bisa dilakukan meski Sesi induknya sudah "ended" — hanya submission baru & struktur Form yang terkunci.
    async decide(
      principal: MasterDataPrincipal,
      submissionId: string,
      input: Readonly<{ status: "accepted" | "rejected"; score: number | null }>,
    ): Promise<{ ok: true } | DecideFailure> {
      const submission = await dependencies.store.findById(principal.tenantId, submissionId);
      if (!submission) return { ok: false, code: "not-found" };
      const updated = await dependencies.store.applyDecision(principal.tenantId, submissionId, submission.version, {
        status: input.status,
        score: input.score,
        updatedAt: now(),
      });
      if (!updated) return { ok: false, code: "conflict" };
      return { ok: true };
    },
  };
}
