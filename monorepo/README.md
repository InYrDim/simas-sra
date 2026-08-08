# SIMAS (Monorepo)

Aplikasi SIMAS — platform multitenant manajemen sekolah (tenant approval, onboarding, dan RBAC role/permission per tenant). Folder ini berisi aplikasi utama (Next.js); konteks keseluruhan repo ada di [`../README.md`](../README.md).

## Stack & Konvensi

- **Next.js 16 (App Router)** + **React 19** + **TypeScript**; semua perintah memakai `pnpm`.
- **Server Component** adalah default; `'use client'` hanya bila butuh interaktivitas, browser API, atau hook.
- **Async Request APIs** — `params`, `searchParams`, `cookies()`, `headers()` semuanya async; selalu `await`.
- **`proxy`** (bukan middleware) untuk logic level route, mis. cek tenant dari subdomain.
- **Caching opt-in** — pakai direktif `"use cache"`, tidak implisit.
- **Tailwind v4** — design token lewat `@theme` di CSS, bukan `tailwind.config.js`.
- **UI** — Base UI + shadcn; komponen reusable di `components/ui`.
- **Data & auth** — Drizzle ORM + mysql2, better-auth.

Konvensi dan aturan editor lengkap: [`Monorepo/AGENTS.md`](AGENTS.md).

## Prasyarat

- Node.js (LTS) dan pnpm (lihat `packageManager` di `package.json` — `pnpm@11.8.0`)
- Docker untuk MySQL dev

## Install & Menjalankan

```bash
pnpm install
```

Jalankan MySQL dev dari `compose.yml` (MySQL 8.4, volume `db_data`):

```bash
docker compose up -d mysql
```

MySQL dev: port `DB_PORT` (default 3337), database `DB_NAME` (default `simas`).

### Environment

Isi variabel environment di `.env` (git-ignored, tidak di-commit; `.env.prod` untuk produksi):

- `DATABASE_URL` — DSN MySQL ke database dev `simas` (host port `DB_PORT`, sesuaikan dengan `.env`/`compose.yml`).
- `SDN191_SCHOOL_ADMIN_PASSWORD`, `SDN191_GURU_PASSWORD`, `SDN191_SISWA_PASSWORD` — nilai password untuk akun uji tiga role SDN 191 diambil dari env **non-commit**. Jangan pernah commit kredensial literal; `.env` sudah di-ignore oleh git.

### Dev server

```bash
pnpm dev
```

- Aplikasi: `http://localhost:3000`
- Akses per tenant via subdomain: `http://<domain>.localhost:3000`
- Tenant uji: SDN 191 — `uptd-sdn-191-inpres-batunapara`

## Script

| Perintah | Keterangan |
| --- | --- |
| `pnpm dev` | Dev server (port 3000) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test:unit` | Unit test |
| `pnpm test:mysql` | Test yang memerlukan MySQL aktif |
| `pnpm test:e2e` | E2E Playwright (seluruh spec) |
| `pnpm rbac:health:check` | Health check RBAC tenant aktif (mis. SDN 191) |
| `pnpm db:provision:sdn191` | Provisioning tenant SDN 191 — **idempoten** |
| `pnpm db:assign:sdn191-guru-absensi` | Assign role guru ke module absensi SDN 191 |
| `pnpm db:cleanup:sdn191` | Cleanup role legacy SDN 191 |

## Permission & RBAC

- **Registry permission** — `lib/authorization/tenant-rbac-contract.ts`; key berformat `${module}.${resource}.${action}` (3 segmen).
- **Evaluator** — `lib/authorization/tenant-authorization.ts`; menentukan apakah sebuah aksi diizinkan untuk role pada tenant tertentu.
- **Guard server** — `enforceAuthorizedTenantOperation`; melindungi operation (halaman/API) dengan permission tenant.
- **Filter menu** — `isNavigationItemAuthorized` di `lib/authorization/tenant-nav-item-authorization.ts` (modul server-safe); menu hanya tampil sesuai izin.
- **Homepage fallback** — `lib/authorization/tenant-home-route.ts`; mengarahkan tenant ke halaman pertama yang boleh diakses.
- **Manajemen roles (UI)** — menu sidebar **"Roles"** (admin-only, `tenant.roles.list`) pada grup "Manajemen" → `/{domain}/settings/roles`. Dialog create/edit menampilkan permission nyata dari registry lewat katalog `lib/authorization/tenant-role-permission-catalog.ts` (key tenant-assignable, dikelompokkan per modul). Lifecycle role: **draft → active → archived**; "hapus" = archive (hanya bila `userCount = 0`), tidak ada delete permanen maupun restore dari UI.

Tenant uji RBAC: **SDN 191** (`uptd-sdn-191-inpres-batunapara`). Provisioning data dilakukan `scripts/provision-sdn-191.ts` (idempoten); assignment role via `scripts/assign-sdn191-guru-absensi.ts`.

### Test E2E RBAC

Spec E2E RBAC ada di `e2e/rbac-*.spec.ts`, termasuk `e2e/rbac-roles-ui.spec.ts` untuk UI manajemen roles. Dari folder ini:

```powershell
$env:E2E_BASE_URL = "http://localhost:3000"
pnpm exec playwright test "rbac-"
```

Pastikan dev server (port 3000) dan MySQL aktif; argumen `"rbac-"` diperlakukan sebagai string literal (PowerShell tidak glob-expand path), sehingga hanya spec `rbac-*` yang dijalankan. Untuk seluruh suite: `pnpm test:e2e`.
