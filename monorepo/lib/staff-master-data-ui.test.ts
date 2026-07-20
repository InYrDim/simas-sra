import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("staff page uses the shared responsive workspace and separates person from profile fields", async () => {
  const source = await readFile(new URL("../app/(tenant)/[domain]/(authenticated)/master/staf/page.tsx", import.meta.url), "utf8");
  assert.match(source, /MasterDataWorkspace/); assert.match(source, /Data pribadi Warga Sekolah/); assert.match(source, /Profil Staf/); assert.match(source, /Status Akun Pengguna/); assert.match(source, /Unit kerja/); assert.match(source, /Jenis kepegawaian/); assert.match(source, /Riwayat jabatan/); assert.match(source, /Riwayat status dan masa kerja/); assert.match(source, /Ubah status Staf/); assert.match(source, /Arsipkan Profil Staf/); assert.match(source, /Aktifkan kembali Profil Staf/); assert.match(source, /Status tidak dapat diubah melalui edit biasa/); assert.match(source, /Akun Pengguna tertaut masih aktif/); assert.doesNotMatch(source, /data bukan data Staf tersimpan/i);
});
