# 02 — Tenant Database Integration

**What to build:** Pembuatan tabel `tenant` di database (menggunakan Drizzle) dan seed script untuk mengisi data. Halaman subdomain yang sebelumnya statis sekarang akan melakukan query ke database dan menampilkan nama Tenant yang asli, atau error 404 jika domain tidak terdaftar.

**Blocked by:** 01 — Subdomain Routing Skeleton

**Status:** ready-for-agent

- [ ] Skema `tenant` dibuat di Drizzle (termasuk kolom id, domain, nama, dll).
- [ ] Seed script dibuat dan berhasil memasukkan dummy tenant ke database.
- [ ] Halaman `(tenant)/[domain]/page.tsx` terhubung ke database dan menampilkan data tenant.
- [ ] Jika diakses dengan subdomain yang salah/tidak ada di DB, Next.js me-return `notFound()`.
