import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("teacher page uses the shared responsive workspace and separates person from profile fields", async () => {
  const source = await readFile(new URL("../app/(tenant)/[domain]/(authenticated)/master/guru/page.tsx", import.meta.url), "utf8");
  assert.match(source, /MasterDataWorkspace/); assert.match(source, /Data pribadi Warga Sekolah/); assert.match(source, /Profil Guru/); assert.match(source, /Status Akun Pengguna/); assert.match(source, /Rombongan Belajar/); assert.match(source, /Jenis kepegawaian/); assert.match(source, /Riwayat status dan masa kerja/); assert.match(source, /Ubah status Guru/); assert.match(source, /Arsipkan Profil Guru/); assert.match(source, /Aktifkan kembali Profil Guru/); assert.match(source, /Status tidak dapat diubah melalui edit biasa/); assert.match(source, /Akun Pengguna tertaut masih aktif/); assert.doesNotMatch(source, /data bukan data Guru tersimpan/i);
});
