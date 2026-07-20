# 01 — Lindungi seluruh area Master Data

**What to build:** Buat satu aturan akses server-side untuk seluruh Master Data. Hanya School Admin dari Tenant yang cocok dengan domain URL yang boleh membaca atau mengubah data. Sediakan feature flag terpisah untuk read dan write, lalu sembunyikan menu Master Data dari role lain.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] User yang belum login diarahkan ke login dan tujuan awal tetap tersimpan.
- [ ] School Admin dari Tenant dan domain yang cocok dapat membuka route Master Data ketika read flag aktif.
- [ ] Role Tenant selain School Admin mendapat `403`, termasuk ketika membuka direct URL.
- [ ] Domain tidak dikenal, domain yang tidak cocok, dan record milik Tenant lain menghasilkan `404` tanpa membocorkan apakah record tersebut ada.
- [ ] Tenant aktif dan active trial dapat read/write; expired trial read-only dan boleh download template; suspended read-only tanpa template; closed dan status tidak dikenal ditolak.
- [ ] Read flag dan write flag diperiksa server-side, bukan hanya melalui tombol atau menu.
- [ ] Menu Master Data dan semua child menu hanya terlihat untuk School Admin.
- [ ] Authorization menghasilkan principal dengan `tenantId` yang berasal dari session/domain, bukan input client.
- [ ] Test command, route/access adapter, dan cross-Tenant denial mencakup setiap kondisi di atas.
