import { randomUUID } from "node:crypto";

export type SimasApplicationInput = {
  schoolName: unknown;
  npsn: unknown;
  educationLevel: unknown;
  address: unknown;
  contactName: unknown;
  contactPosition: unknown;
  contactEmail: unknown;
  contactWhatsapp: unknown;
  needsNote?: unknown;
};

export type NewSimasApplication = Readonly<{
  id: string;
  schoolName: string;
  npsn: string;
  educationLevel: string;
  address: string;
  contactName: string;
  contactPosition: string;
  contactEmail: string;
  contactWhatsapp: string;
  needsNote: string | null;
  status: "pending";
  submittedAt: Date;
  decidedAt: null;
  decidedByProviderAdminId: null;
  rejectionReason: null;
  approvedTenantId: null;
}>;

export type SimasApplicationWriter = Readonly<{
  create(application: NewSimasApplication): Promise<void>;
}>;

type ValidationErrors = Partial<
  Record<keyof SimasApplicationInput, string>
>;

export type SubmitSimasApplicationResult =
  | { ok: true; applicationId: string }
  | { ok: false; errors: ValidationErrors };

type SubmitDependencies = {
  createId?: () => string;
  now?: () => Date;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizedText(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function normalizeNpsn(value: unknown): string {
  return normalizedText(value).replace(/[\s-]/g, "");
}

function normalizeEmail(value: unknown): string {
  return normalizedText(value).toLowerCase();
}

function normalizeWhatsapp(value: unknown): string {
  const text = normalizedText(value);
  if (!/^\+?[\d(). -]+$/.test(text)) return "";

  const digits = text.replace(/\D/g, "");
  if (digits.startsWith("0")) return `+62${digits.slice(1)}`;
  if (digits.startsWith("62")) return `+${digits}`;
  return text.startsWith("+") ? `+${digits}` : "";
}

function requiredText(
  errors: ValidationErrors,
  field: keyof SimasApplicationInput,
  value: string,
  maxLength: number,
) {
  if (!value) errors[field] = "Wajib diisi.";
  else if (value.length > maxLength) errors[field] = `Maksimal ${maxLength} karakter.`;
}

async function submitSimasApplication(
  input: SimasApplicationInput,
  writer: SimasApplicationWriter,
  dependencies: SubmitDependencies = {},
): Promise<SubmitSimasApplicationResult> {
  const schoolName = normalizedText(input.schoolName);
  const npsn = normalizeNpsn(input.npsn);
  const educationLevel = normalizedText(input.educationLevel);
  const address = normalizedText(input.address);
  const contactName = normalizedText(input.contactName);
  const contactPosition = normalizedText(input.contactPosition);
  const contactEmail = normalizeEmail(input.contactEmail);
  const contactWhatsapp = normalizeWhatsapp(input.contactWhatsapp);
  const normalizedNeedsNote = normalizedText(input.needsNote);
  const errors: ValidationErrors = {};

  requiredText(errors, "schoolName", schoolName, 255);
  requiredText(errors, "educationLevel", educationLevel, 64);
  requiredText(errors, "address", address, 10_000);
  requiredText(errors, "contactName", contactName, 255);
  requiredText(errors, "contactPosition", contactPosition, 255);

  if (!/^\d{8}$/.test(npsn)) errors.npsn = "NPSN harus terdiri dari 8 digit.";
  if (!EMAIL_PATTERN.test(contactEmail) || contactEmail.length > 255) {
    errors.contactEmail = "Email tidak valid.";
  }
  if (!/^\+62\d{8,13}$/.test(contactWhatsapp)) {
    errors.contactWhatsapp = "Nomor WhatsApp Indonesia tidak valid.";
  }
  if (normalizedNeedsNote.length > 10_000) {
    errors.needsNote = "Maksimal 10000 karakter.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const id = (dependencies.createId ?? randomUUID)();
  await writer.create({
    id,
    schoolName,
    npsn,
    educationLevel,
    address,
    contactName,
    contactPosition,
    contactEmail,
    contactWhatsapp,
    needsNote: normalizedNeedsNote || null,
    status: "pending",
    submittedAt: (dependencies.now ?? (() => new Date()))(),
    decidedAt: null,
    decidedByProviderAdminId: null,
    rejectionReason: null,
    approvedTenantId: null,
  });

  return { ok: true, applicationId: id };
}

export function createSimasApplicationCommands(
  writer: SimasApplicationWriter,
  dependencies: SubmitDependencies = {},
) {
  return Object.freeze({
    submit: (input: SimasApplicationInput) =>
      submitSimasApplication(input, writer, dependencies),
  });
}
