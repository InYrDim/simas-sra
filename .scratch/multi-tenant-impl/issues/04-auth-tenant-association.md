# 04 — Auth & Tenant Association

**What to build:** Modifikasi sistem otentikasi sehingga akun pengguna (user) terkait dengan suatu tenant. Halaman profil atau UI sederhana akan menunjukkan "Anda login sebagai X di Tenant Y".

**Blocked by:** 02 — Tenant Database Integration

**Status:** ready-for-agent

- [ ] Kolom `tenantId` (foreign key) ditambahkan ke tabel `user` (atau relasi yang sesuai).
- [ ] User seed dummy dibuat dan terikat dengan sebuah tenant.
- [ ] Komponen UI sederhana menampilkan nama user dan ID/nama tenant-nya setelah login.
