import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
test("Sarana & Prasarana uses the shared responsive location workspace", async()=>{ const source=await readFile(new URL("../app/(tenant)/[domain]/(authenticated)/master/sarpras/page.tsx",import.meta.url),"utf8"); for(const text of ["MasterDataWorkspace","Lokasi/Ruang","Parent \\(opsional\\)","Detail hierarchy","Status arsip","Arsipkan lokasi","Aktifkan kembali","blocker"]) assert.match(source,new RegExp(text)); assert.match(source,/sm:grid-cols-2/); });
