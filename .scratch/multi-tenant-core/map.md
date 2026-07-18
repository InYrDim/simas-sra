Status: open
Labels: wayfinder:map

## Destination

Spesifikasi Arsitektur Multi-tenant, Routing, dan Trial untuk SIMAS. Memastikan pembagian struktur antara Provider dan Sekolah dalam satu monorepo Next.js.

## Notes

Domain: Aplikasi SaaS pendidikan (SIMAS).
Teknologi: Next.js 16 (App Router), Drizzle ORM, Single Database.

## Decisions so far

- [01-routing-strategy.md](issues/01-routing-strategy.md) — Routing menggunakan Subdomain dengan dukungan Custom Domain.
- [02-db-isolation.md](issues/02-db-isolation.md) — Single database dengan `tenant_id`, Feature Flags, dan JSONB.
- [03-trial-mechanism.md](issues/03-trial-mechanism.md) — Masa trial 1 bulan, setelah habis akan berubah menjadi Read-only mode.

## Not yet specified

- Detail teknis implementasi Middleware Next.js untuk membaca domain secara dinamis.
- Cara paling elegan memberlakukan "Read-Only" mode di seluruh aplikasi (API layer vs UI layer).
- Struktur spesifik file Drizzle schema untuk tabel `tenants`.

## Out of scope

- Sistem pembayaran atau payment gateway (hanya memblokir akses secara logis).
