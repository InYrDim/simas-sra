# 05 — Sesi Absensi (Gerbang)

Type: task
Status: ready-for-agent
Blocked by: 02

## Brief

Tambahkan konsep **Sesi** pada perekaman Absensi Gerbang. Sesi adalah jendela waktu
(per lapisan, per hari) yang dibuka/ditutup oleh School Admin. Perekaman yang terjadi
di luar jendela sesi yang terbuka dicatat sebagai **luar sesi** (`outOfSession = true`)
dan dapat membawa catatan opsional (alasan terlambat) di kolom `notes` yang sudah ada.

Fase ini hanya mencakup lapisan **gerbang**; kelas menyusul di issue terpisah (desain
tabel sesi sudah mendukung `layer`).

## Keputusan desain (terkonfirmasi dengan user)

1. **Cakupan**: sesi per lapisan (gerbang & kelas masing-masing). Implementasi gerbang dulu.
2. **Siklus**: instance sesi eksplisit (`attendance_session`) dengan `openedAt`/`closedAt`.
   "Buat sesi" = langsung buka (`openedAt = now`) dengan jendela terencana
   (`plannedStart`–`plannedEnd`). "Selesai sesi" = tutup (`closedAt = now`).
3. **Luar sesi**: flag terpisah `outOfSession` boolean + `sessionId` FK nullable.
   Enum `status` tetap bersih; CHECK `attendance_record_layer_status_check` **tidak** diubah.
4. **Satu sesi** per lapisan per hari.
5. **Catatan terlambat**: reuse kolom `notes` (varchar 500) yang sudah ada.
6. **Jendela konfigurasi**: disimpan di `tenant.settings` (JSON) sebagai bagian
   `AbsensiSettings.sessionWindow` per lapisan, mis. `{ gerbang: { start: "06:30", end: "07:30" } }`.
   Saat admin "Buat Sesi", jendela ini dipakai sebagai `plannedStart`/`plannedEnd` untuk hari ini.

## Data model

### Tabel baru: `attendance_session`

```ts
export const attendanceSession = mysqlTable(
  "attendance_session",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenant.id),
    layer: mysqlEnum("layer", ["gerbang", "kelas"]).notNull(),
    sessionDate: date("session_date", { mode: "string" }).notNull(),
    plannedStart: time("planned_start", { fsp: 0 }).notNull(),
    plannedEnd: time("planned_end", { fsp: 0 }).notNull(),
    openedAt: timestamp("opened_at", { fsp: 3 }).notNull(),
    closedAt: timestamp("closed_at", { fsp: 3 }),
    openedByUserId: varchar("opened_by_user_id", { length: 36 }).notNull(),
    status: mysqlEnum("status", ["open", "closed"]).notNull(),
    notes: varchar("notes", { length: 500 }),
    version: int("version").default(1).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull(),
  },
  (table) => [
    unique("attendance_session_tenant_layer_date_unique").on(table.tenantId, table.layer, table.sessionDate),
    foreignKey({ columns: [table.tenantId, table.openedByUserId], foreignColumns: [user.tenantId, user.id], name: "attendance_session_tenant_actor_fkey" }),
    check("attendance_session_version_check", sql`${table.version} > 0`),
    check("attendance_session_window_check", sql`${table.plannedEnd} > ${table.plannedStart}`),
  ],
);
```

### Modifikasi `attendance_record`

- Tambah `sessionId: varchar("session_id", { length: 36 })` nullable → `attendance_session(tenantId, id)`
- Tambah `outOfSession: boolean("out_of_session").default(false).notNull()`
- CHECK `attendance_record_layer_status_check` **tetap**.
- Index `(tenantId, sessionId)` untuk lookup per sesi.

## Config (`attendance-config.ts`)

Tambah ke `AbsensiSettings`:

```ts
sessionWindow?: Partial<Record<AttendanceLayer, { start: string; end: string }>>;
```

- `start`/`end` format `"HH:MM"` (24h).
- `readAbsensiSettings` / `mergeAbsensiSettings` membaca & memvalidasi format jam.
- Default gerbang: `06:30`–`07:30` bila tidak diisi.

## Write path (`attendance-record-write.ts`)

- `resolveOpenSession(tenantId, layer, at = new Date())`: cari `attendance_session`
  dengan `layer`, `sessionDate = at` (tanggal lokal tenant), `status = 'open'`.
  Kembalikan null bila tidak ada.
- `recordAttendance(input)` diperluas:
  - setelah resolve student, cari `session = resolveOpenSession(tenantId, layer, recordedAt)`.
  - bila `session` ada DAN `recordedAt` dalam `[plannedStart, plannedEnd]` →
    `sessionId = session.id`, `outOfSession = false`.
  - selain itu → `sessionId = null`, `outOfSession = true`.
  - `notes` (opsional) diteruskan apa adanya (dipakai untuk alasan terlambat saat luar sesi).
- `listGerbangRecordsForDay` tetap; tambah `listGerbangRecordsBySession(tenantId, sessionId)`
  untuk tampilan per sesi.

## Server action (`absensi/actions.ts`)

- `recordGerbangAction`: tidak berubah secara signature; `recordAttendance` otomatis
  menentukan sesi/luar-sesi. Bila `outOfSession`, UI mengirim `notes` opsional.
- Baru: `openGerbangSessionAction(domain, formData?)`:
  - `enforceTenantOperation(domain, "absensi.gerbang.session.manage")`
  - baca `sessionWindow.gerbang` dari settings (fallback default), buat `attendance_session`
    (`openedAt = now`, `status = 'open'`, `sessionDate = hari ini`).
  - tolak bila sudah ada sesi terbuka untuk hari ini (unique constraint cadangan).
- Baru: `closeGerbangSessionAction(domain, sessionId)`:
  - `enforceTenantOperation(domain, "absensi.gerbang.session.manage")`
  - set `closedAt = now`, `status = 'closed'`.

## RBAC / gating

- Operasi baru: `absensi.gerbang.session.manage` (permission `absensi.gerbang.session.manage`),
  `requires: ["absensiGerbang"]`. School Admin otomatis dapat (active operation).
- Daftarkan di `tenant-rbac-contract.ts` (`activeSeeds` + operation map). Bump
  `permissionRegistry.length` assertion di `tenant-rbac-contract.test.ts`.
- Feature-gate: tolak bila `absensiGerbang` nonaktif (sudah di-enforce oleh operation requires).

## UI (`absensi/gerbang/page.tsx` + `gerbang-record-form.tsx`)

- Panel "Sesi Gerbang" di atas form rekam:
  - Bila belum ada sesi terbuka hari ini: tombol **Buat Sesi** (loader saat submit).
  - Bila sesi terbuka: tampilkan jendela (`plannedStart`–`plannedEnd`), status "Sesi Terbuka",
    tombol **Selesai Sesi** (loader).
- Form rekam gerbang: saat rekam di luar sesi (atau sesi belum dibuat), tampilkan field
  **Catatan (opsional)** untuk alasan terlambat; dikirim sebagai `notes`.
- Tampilan "hari ini": kelompokkan berdasarkan sesi; rekam `outOfSession = true` ditandai
  (mis. badge "Luar Sesi") dan menampilkan `notes` bila ada.
- Semua aksi async wajib loader (sesuai panduan AGENTS.md).

## Tests

- Unit (pure) `attendance-record-write.test.ts`:
  - `resolveOpenSession` mengembalikan sesi terbuka; null bila tidak ada/tutup.
  - `recordAttendance` dalam jendela → `sessionId` terisi, `outOfSession = false`.
  - `recordAttendance` luar jendela / tanpa sesi → `sessionId = null`, `outOfSession = true`,
    `notes` tersimpan.
- MySQL `attendance-record-data.mysql.test.ts` (atau file sesi baru):
  - buat sesi → rekam dalam jendela → assert `sessionId` + `outOfSession=false`.
  - rekam luar jendela → assert `outOfSession=true`.
  - tenant-isolation: sesi & rekam milik tenant lain tidak bocor.

## Acceptance

- [ ] Tabel `attendance_session` ada di schema & DB dev (buat via SQL langsung — lihat catatan
      migrasi di bawah; `db:migrate`/`db:push` tidak usable di env ini).
- [ ] `attendance_record` punya `sessionId` + `outOfSession`; CHECK layer/status utuh.
- [ ] `recordAttendance` menentukan sesi/luar-sesi otomatis; `notes` reuse untuk alasan terlambat.
- [ ] Action buka/tutup sesi + RBAC `absensi.gerbang.session.manage` terdaftar & tergate.
- [ ] UI panel sesi + form catatan luar sesi + tampilan per-sesi, semua dengan loader.
- [ ] Unit + MySQL test hijau; `pnpm typecheck`, `pnpm lint`, `pnpm rbac:coverage` hijau.

## Catatan migrasi DB

DB dev diprovisi via `db:push` (tanpa journal) → `pnpm db:migrate` & `pnpm db:push` tidak
bisa dipakai. Tabel/column baru dibuat via SQL langsung (CREATE TABLE / ALTER TABLE) yang
cocok persis dengan definisi drizzle, lalu dijadikan migration snapshot manual di
`monorepo/drizzle/` bila diperlukan.
