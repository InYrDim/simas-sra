# 08 — Feature Flags Infrastructure

**What to build:** Implementasi custom features per tenant tanpa mengubah skema tabel utama, melainkan via data JSONB di tabel `tenant`. UI akan bereaksi terhadap flag ini.

**Blocked by:** 02 — Tenant Database Integration

**Status:** ready-for-agent

- [ ] Kolom `settings` (tipe JSONB) ditambahkan pada skema `tenant`.
- [ ] Fungsi pembantu `hasFeature(tenantId, featureName)` dibuat.
- [ ] Komponen UI dummy (contoh "Advanced Analytics") yang hanya di-render jika fungsi `hasFeature` mereturn true.
