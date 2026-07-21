import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Provider sidebar signs out the active session before returning to login", async () => {
  const source = await readFile(
    new URL("./provider-sidebar.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /authClient\.signOut/);
  assert.match(source, /window\.location\.assign\("\/login"\)/);
  assert.match(source, /tooltip="Keluar"/);
  assert.match(source, /<span>Keluar<\/span>/);
});
