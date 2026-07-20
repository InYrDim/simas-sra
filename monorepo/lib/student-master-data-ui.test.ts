import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("student page uses the shared responsive workspace and separates person from profile fields", async () => {
  const source = await readFile(new URL("../app/(tenant)/[domain]/(authenticated)/master/siswa/page.tsx", import.meta.url), "utf8");
  assert.match(source, /MasterDataWorkspace/); assert.match(source, /Data pribadi Warga Sekolah/); assert.match(source, /Profil Siswa/); assert.match(source, /Status Akun Pengguna/); assert.match(source, /Rombongan Belajar/); assert.doesNotMatch(source, /data bukan data Siswa tersimpan/i);
});
