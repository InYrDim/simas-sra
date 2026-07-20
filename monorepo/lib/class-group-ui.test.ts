import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
test("Rombel page uses shared responsive workspace and separates lifecycle from archive", async () => { const source = await readFile(new URL("../app/(tenant)/[domain]/(authenticated)/master/rombel/page.tsx", import.meta.url), "utf8"); assert.match(source, /MasterDataWorkspace/); assert.match(source, /Tahun Ajaran/); assert.match(source, /Lokasi utama \(opsional\)/); assert.match(source, /Aktifkan Rombel/); assert.match(source, /Tutup Rombel/); assert.match(source, /Batalkan Rombel/); assert.match(source, /Arsipkan Rombel/); assert.match(source, /Reactivate|Reactivation/); assert.match(source, /Status arsip/); assert.match(source, /dikunci setelah Rombel aktif/); });
