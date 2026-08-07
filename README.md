# SIMAS

SIMAS adalah platform multitenant untuk manajemen sekolah: sekolah mengajukan permintaan sebagai tenant, disetujui dan di-onboarding oleh provider, lalu dikelola lewat UI role dan permission (RBAC) per tenant. Setiap tenant memiliki subdomain sendiri dan hanya melihat menu serta data sesuai izin yang diberikan.

## Struktur Repositori

- `Monorepo/` — aplikasi utama (Next.js 16 App Router, React 19, TypeScript, Drizzle ORM, better-auth, Tailwind v4). Semua perintah dijalankan dari folder ini.
- Folder lain di root (`Docs/`, `Roadmap/`, dll.) berisi dokumen dan catatan kerja.

Dokumentasi lengkap aplikasi: [`Monorepo/README.md`](Monorepo/README.md).

## Prasyarat

- Node.js (LTS) dan pnpm
- Docker (untuk MySQL dev)

## Setup & Menjalankan

1. Jalankan MySQL dari `Monorepo/compose.yml` (MySQL 8.4):

   ```sh
   cd Monorepo
   docker compose up -d mysql
   ```

   MySQL dev tersedia di port 3337 (`DB_PORT`), database `simas` (`DB_NAME`).

2. Isi variabel environment wajib di file `Monorepo/.env` (file ini git-ignored, tidak di-commit). Daftar variabel wajib — termasuk kredensial uji dari env non-commit — ada di [`Monorepo/README.md`](Monorepo/README.md).

3. Pasang dependensi lalu jalankan dev server:

   ```sh
   cd Monorepo
   pnpm install
   pnpm dev
   ```

   - Aplikasi tenant: `http://localhost:3000`
   - Akses per tenant via subdomain: `http://<domain>.localhost:3000` (contoh tenant uji SDN 191: `uptd-sdn-191-inpres-batunapara`)

## Menjalankan Test

Semua test dijalankan dari `Monorepo/` dengan `pnpm`:

```sh
pnpm test:unit   # unit test
pnpm test:e2e    # E2E Playwright (subset RBAC, lihat Monorepo/README.md)
```

Untuk perintah test MySQL, RBAC health check, DB provisioning SDN 191, dan subset E2E RBAC, lihat [`Monorepo/README.md`](Monorepo/README.md).
