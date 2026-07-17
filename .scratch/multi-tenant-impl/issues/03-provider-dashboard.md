# 03 — Provider Dashboard (Read)

**What to build:** Antarmuka dasar untuk sisi Provider (pemilik aplikasi). Halaman utama `app/(provider)/` yang terisolasi dari routing tenant akan membaca tabel `tenant` dan menampilkan semua sekolah yang terdaftar dalam sebuah list atau tabel.

**Blocked by:** 02 — Tenant Database Integration

**Status:** resolved

- [x] Struktur folder `app/(provider)/dashboard/page.tsx` dibuat.
- [x] Akses ke `localhost:3000` (atau domain utama provider) diatur oleh proxy agar tidak masuk ke route `(tenant)`.
- [x] Halaman provider berhasil mengambil dan me-render semua data dari tabel `tenant`.

## Answer

Created `app/(provider)/dashboard/page.tsx` to serve as the Provider Dashboard. It fetches the list of all tenants from the database using standard Drizzle `select().from()` and renders them in a neat dashboard interface (using Shadcn UI Card and Table components). The proxy allows direct access to the dashboard from the main domain without rewriting to the tenant layout.
