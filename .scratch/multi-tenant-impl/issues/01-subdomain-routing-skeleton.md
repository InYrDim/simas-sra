# 01 — Subdomain Routing Skeleton

**What to build:** Mengatur middleware Next.js agar bisa membaca subdomain dan me-rewrite request ke struktur folder `app/(tenant)/[domain]/`. Tanpa koneksi database, layar hanya menampilkan tulisan nama subdomain yang sedang diakses.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] File `middleware.ts` dibuat dan mampu mem-parsing hostname (localhost:3000 atau domain produksi).
- [x] Terdapat struktur folder `app/(tenant)/[domain]/page.tsx`.
- [x] Akses ke `sekolah-a.localhost:3000` berhasil di-rewrite secara internal ke route `(tenant)/sekolah-a` tanpa mengubah URL di browser.
- [x] Halaman menampilkan param `[domain]` di layar.

## Answer

Implemented middleware at `monorepo/middleware.ts` to parse hostname and rewrite requests with subdomains to `/[domain]${path}`. The folder `monorepo/app/(tenant)/[domain]/page.tsx` was created to handle the rewritten requests and display the domain parameter.
