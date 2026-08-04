import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

import { findForbiddenLegacyAuthorityReferences } from "@/lib/authorization/tenant-rbac-legacy-authority-verifier";

async function collect(root: string): Promise<readonly { path: string; content: string }[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: { path: string; content: string }[] = [];
  for (const entry of entries) {
    const absolute = join(root, entry.name);
    if (entry.isDirectory()) files.push(...await collect(absolute));
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) {
      files.push({ path: relative(process.cwd(), absolute), content: await readFile(absolute, "utf8") });
    }
  }
  return files;
}

async function main(): Promise<void> {
  const files = [
    ...(await collect(join(process.cwd(), "app"))),
    ...(await collect(join(process.cwd(), "lib"))),
    ...(await collect(join(process.cwd(), "scripts"))),
  ];
  const findings = findForbiddenLegacyAuthorityReferences(files);
  if (findings.length > 0) {
    console.error(`Found ${findings.length} forbidden runtime legacy-authority reference(s):`);
    for (const finding of findings) console.error(`${finding.file}:${finding.line} ${finding.reference}`);
    process.exitCode = 1;
  } else {
    console.log("No forbidden runtime legacy-authority references found.");
  }
}

void main();
