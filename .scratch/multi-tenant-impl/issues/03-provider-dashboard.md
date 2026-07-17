# 03 — Provider Dashboard (Read)

**What to build:** Antarmuka dasar untuk sisi Provider (pemilik aplikasi). Halaman utama `app/(provider)/` yang terisolasi dari routing tenant akan membaca tabel `tenant` dan menampilkan semua sekolah yang terdaftar dalam sebuah list atau tabel.

**Blocked by:** 02 — Tenant Database Integration

**Status:** ready-for-agent

- [ ] Struktur folder `app/(provider)/page.tsx` dibuat.
- [ ] Akses ke `localhost:3000` (atau domain utama provider) diatur oleh middleware agar tidak masuk ke route `(tenant)`.
- [ ] Halaman provider berhasil mengambil dan me-render semua data dari tabel `tenant`.
