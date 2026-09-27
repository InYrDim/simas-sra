import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("student page uses the shared responsive workspace and separates person from profile fields", async () => {
  // The status-edit warning moved into the shared StudentForm component, so the
  // contract spans the page and its form component.
  const [page, form] = await Promise.all([
    readFile(new URL("../../app/(tenant)/[domain]/(authenticated)/master/siswa/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/(tenant)/[domain]/(authenticated)/master/siswa/student-form.tsx", import.meta.url), "utf8"),
  ]);
  const source = `${page}\n${form}`;
  assert.match(source, /MasterDataWorkspace/); assert.match(source, /Data pribadi Warga Sekolah/); assert.match(source, /Profil Siswa/); assert.match(source, /Status Akun Pengguna/); assert.match(source, /Rombongan Belajar/); assert.match(source, /Ubah status Siswa/); assert.match(source, /Koreksi Kelulusan/); assert.match(source, /Arsipkan Profil Siswa/); assert.match(source, /Aktifkan kembali Profil Siswa/); assert.match(source, /Status tidak dapat diubah melalui edit biasa/); assert.match(source, /Akun Pengguna tertaut masih aktif/); assert.doesNotMatch(source, /data bukan data Siswa tersimpan/i);
});
