import type { PpdbFormField } from "@/lib/ppdb-session";

const FIELDS_PER_STEP = 3;
const FILES_PER_STEP = 2;

export type PpdbFormStep =
  | { kind: "fields"; title: string; fields: PpdbFormField[] }
  | { kind: "files"; title: string; fields: PpdbFormField[] }
  | { kind: "review"; title: string };

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

export function buildPpdbFormSteps(fields: readonly PpdbFormField[]): PpdbFormStep[] {
  const regularChunks = chunk(fields.filter((field) => field.type !== "file"), FIELDS_PER_STEP);
  const fileChunks = chunk(fields.filter((field) => field.type === "file"), FILES_PER_STEP);

  const steps: PpdbFormStep[] = [];
  regularChunks.forEach((group, index) => {
    steps.push({
      kind: "fields",
      title: regularChunks.length > 1 ? `Informasi Pribadi (${index + 1}/${regularChunks.length})` : "Informasi Pribadi",
      fields: group,
    });
  });
  fileChunks.forEach((group, index) => {
    steps.push({
      kind: "files",
      title: fileChunks.length > 1 ? `Upload Dokumen (${index + 1}/${fileChunks.length})` : "Upload Dokumen",
      fields: group,
    });
  });
  steps.push({ kind: "review", title: "Konfirmasi Pendaftaran" });
  return steps;
}
