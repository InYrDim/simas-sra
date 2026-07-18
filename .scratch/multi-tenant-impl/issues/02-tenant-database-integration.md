# 02 — Tenant Database Integration

**What to build:** Pembuatan tabel `tenant` di database (menggunakan Drizzle) dan seed script untuk mengisi data. Halaman subdomain yang sebelumnya statis sekarang akan melakukan query ke database dan menampilkan nama Tenant yang asli, atau error 404 jika domain tidak terdaftar.

**Blocked by:** 01 — Subdomain Routing Skeleton

**Status:** resolved

- [x] Skema `tenant` dibuat di Drizzle (termasuk kolom id, domain, nama, dll).
- [x] Seed script dibuat dan berhasil memasukkan dummy tenant ke database.
- [x] Halaman `(tenant)/[domain]/page.tsx` terhubung ke database dan menampilkan data tenant.
- [x] Jika diakses dengan subdomain yang salah/tidak ada di DB, Next.js me-return `notFound()`.

## Answer

Created `tenant` schema in `db/schema.ts` with `drizzle-orm`. Added a seed script `scripts/seed.ts` to populate two dummy tenants. Updated `app/(tenant)/[domain]/page.tsx` to read the domain parameter as a Promise (Next.js 16 style), query the database, and either render the tenant's real name from DB or invoke `notFound()` if the subdomain is unregistered.
