# 01 — Lindungi seluruh area Master Data

**What to build:** Buat satu aturan akses server-side untuk seluruh Master Data. Hanya School Admin dari Tenant yang cocok dengan domain URL yang boleh membaca atau mengubah data. Sediakan feature flag terpisah untuk read dan write, lalu sembunyikan menu Master Data dari role lain.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] User yang belum login diarahkan ke login dan tujuan awal tetap tersimpan.
- [x] School Admin dari Tenant dan domain yang cocok dapat membuka route Master Data ketika read flag aktif.
- [x] Role Tenant selain School Admin mendapat `403`, termasuk ketika membuka direct URL.
- [x] Domain tidak dikenal, domain yang tidak cocok, dan record milik Tenant lain menghasilkan `404` tanpa membocorkan apakah record tersebut ada.
- [x] Tenant aktif dan active trial dapat read/write; expired trial read-only dan boleh download template; suspended read-only tanpa template; closed dan status tidak dikenal ditolak.
- [x] Read flag dan write flag diperiksa server-side, bukan hanya melalui tombol atau menu.
- [x] Menu Master Data dan semua child menu hanya terlihat untuk School Admin.
- [x] Authorization menghasilkan principal dengan `tenantId` yang berasal dari session/domain, bukan input client.
- [x] Test command, route/access adapter, dan cross-Tenant denial mencakup setiap kondisi di atas.

## Answer

Implemented one server-side Master Data access policy with canonical Tenant principals, strict read/write feature flags, lifecycle capabilities, non-disclosing Tenant/record ownership checks, and a nested App Router guard for every existing `/master` page. Added the `suspended` Tenant status migration and made the sidebar use the authenticated role so Master Data and all child links are School Admin-only.

Validation completed with focused Node tests (19 passing), TypeScript typecheck, focused ESLint, and `git diff --check`.
