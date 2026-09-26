# Tetapkan kendali Provider atas Penjadwalan

Type: grilling
Status: resolved
Blocked by: None — diputuskan langsung oleh user saat sesi charting

## Question

Apakah Provider perlu dapat mengaktifkan atau menonaktifkan fitur Penjadwalan untuk
masing-masing Tenant?

## Answer

**Ya, per Tenant.** Diputuskan user (26 September 2026). Penjadwalan menjadi fitur
Tenant-facing yang dikendalikan Provider; desain dan implementasinya mengikuti
`/tenant-feature-gating`:

- Feature key baru di `config/tenant-features.ts` dengan hierarki parent/read/write seperti
  domain lain, route `/jadwal/**`.
- Menu tetap tampil tetapi terkunci + tooltip saat Provider mematikan; halaman dan action
  tetap diblokir server-side lewat `enforceTenantFeatureEnabled`.
- Worker (bila nanti ada) wajib recheck fitur sebelum eksekusi.
- Default legacy ditetapkan eksplisit di tiket implementasi gating. Belum ada Tenant yang
  benar-benar memakai Penjadwalan, jadi default aktif sampai Provider mematikan.

Tidak ada key yang ditambahkan sebelum tiket implementasi gating diambil.
