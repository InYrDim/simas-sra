# 01 — Subdomain Routing Skeleton

**What to build:** Mengatur middleware Next.js agar bisa membaca subdomain dan me-rewrite request ke struktur folder `app/(tenant)/[domain]/`. Tanpa koneksi database, layar hanya menampilkan tulisan nama subdomain yang sedang diakses.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] File `middleware.ts` dibuat dan mampu mem-parsing hostname (localhost:3000 atau domain produksi).
- [ ] Terdapat struktur folder `app/(tenant)/[domain]/page.tsx`.
- [ ] Akses ke `sekolah-a.localhost:3000` berhasil di-rewrite secara internal ke route `(tenant)/sekolah-a` tanpa mengubah URL di browser.
- [ ] Halaman menampilkan param `[domain]` di layar.
