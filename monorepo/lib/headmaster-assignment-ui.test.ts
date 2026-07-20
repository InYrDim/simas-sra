import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Profil Sekolah presents current headmaster, effective-dated history, and eligible Guru assignment", async () => {
  const [page, component] = await Promise.all([
    readFile(new URL("../app/(tenant)/[domain]/(authenticated)/master/profil/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/(tenant)/[domain]/(authenticated)/master/profil/headmaster-history.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /HeadmasterHistory/);
  assert.match(component, /Kepala Sekolah saat ini/);
  assert.match(component, /Riwayat sebelumnya/);
  assert.match(component, /Guru aktif/);
  assert.match(component, /Tanggal efektif/);
  assert.match(component, /Ganti Kepala Sekolah/);
});
