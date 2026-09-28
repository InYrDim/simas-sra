# Migrasi Skema (Drizzle — Postgres)

Dialek aktif: **postgresql** (`drizzle.config.ts` → `db/schema.ts` → folder `drizzle/`).

## Format yang dipakai repo ini: v3 "folders"

Repo ini memakai **drizzle-kit 1.0.0-rc.4** dengan format output **v3 per-folder**:

```
drizzle/
├── 20260916110429_elite_the_renegades/
│   ├── migration.sql      # SQL penuh (baseline: 96 CREATE TABLE, tanpa DROP)
│   └── snapshot.json      # snapshot skema setelah migrasi ini
├── 20260918072850_productive_silverclaw/
│   ├── migration.sql
│   └── snapshot.json
└── ...                    # urutan = urutan nama folder (timestamp prefix)
```

Folder `drizzle/meta/` (format lama) **sengaja tidak ada** — drizzle-kit v1
`prepareOutFolder` membaca `drizzle/*/snapshot.json` langsung, dan
`assertV3OutFolder` justru **menolak** bila `meta/_journal.json` masih ada.
`pnpm db:generate` dan `pnpm db:check` sudah diverifikasi jalan normal dengan
struktur ini ("No schema changes" saat skema sinkron dengan snapshot terakhir).

## Perintah

| Perintah | Fungsi |
|---|---|
| `pnpm db:generate` | Buat migrasi baru dari diff `db/schema.ts` vs snapshot terakhir |
| `pnpm db:migrate` | Terapkan migrasi berurutan ke `DATABASE_URL_UNPOOLED` |
| `pnpm db:push` | Sync skema langsung ke DB tanpa file migrasi (dev saja) |
| `pnpm db:check` | Validasi rantai snapshot/collisions |
| `pnpm db:studio` | Browser data |

## Fresh database

```bash
# 1. Set koneksi
DATABASE_URL=postgres://...          # dipakai aplikasi (db/index.ts)
DATABASE_URL_UNPOOLED=postgres://... # dipakai drizzle-kit

# 2. Buat skema dari nol
pnpm db:migrate   # 96 tabel + fitur berikutnya; aman untuk DB kosong

# 3. Jalankan aplikasi
pnpm dev
```

Catatan:
- Migrasi pertama (`20260916110429_elite_the_renegades`) adalah **baseline
  komplet** — semua enum + 96 tabel + tabel better-auth (`user`, `session`,
  `account`, `verification`). Tidak ada dependency ke MySQL.
- Migrasi `20260927033807_strange_beyonder` memuat `DELETE ... WHERE layer='kelas'`
  (destruktif untuk data lama); pada DB fresh ini no-op karena tabel baru dibuat.
- `meta/_journal.json` lama (format pra-v3) sengaja tidak dipertahankan; jangan
  dibuat ulang manual — drizzle-kit v1 akan error `MigrationsOutdatedCliError`.

## Arsip MySQL

Script cutover era MySQL dan snapshot migrasi MySQL lama dipindah ke
`scripts/archive/` (read-only, tidak dieksekusi, tidak dirujuk package.json).
