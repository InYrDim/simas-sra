import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { validateTenantRbacIncidentEvidence } from "@/lib/authorization/tenant-rbac-incident-evidence";

const MAX_EVIDENCE_BYTES = 1024 * 1024;

async function main(): Promise<void> {
  const input = process.argv[2];
  if (!input || !input.endsWith(".json")) throw new Error("Usage: validate-tenant-rbac-incident-evidence.ts <evidence.json> [--require-exit] [--allow-synthetic]");
  const bytes = await readFile(resolve(input));
  if (bytes.byteLength > MAX_EVIDENCE_BYTES) throw new Error("Evidence file exceeds 1 MiB");
  const evidence = JSON.parse(bytes.toString("utf8")) as unknown;
  const errors = validateTenantRbacIncidentEvidence(evidence, { requireExit: process.argv.includes("--require-exit"), allowSynthetic: process.argv.includes("--allow-synthetic") });
  console.log(JSON.stringify({ valid: errors.length === 0, syntheticAcceptedForSchemaCheckOnly: process.argv.includes("--allow-synthetic"), errors }, null, 2));
  if (errors.length > 0) process.exitCode = 1;
}

void main().catch((error: unknown) => {
  console.error(JSON.stringify({ error: "incident-evidence-validation-failed", message: error instanceof Error ? error.message : "unknown-error" }));
  process.exitCode = 1;
});
