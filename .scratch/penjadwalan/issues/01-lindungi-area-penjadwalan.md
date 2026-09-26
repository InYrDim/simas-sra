# 01 — Lindungi dan siapkan area Penjadwalan

**What to build:** Area Penjadwalan (`/jadwal/**`) menjadi fitur Tenant yang dapat
dikendalikan Provider per Tenant, dengan RBAC sungguhan menggantikan permission placeholder
audit yang sekarang dipakai menu dan operasi `jadwal.*`.

**Blocked by:** None — can start immediately.

**Status:** resolved

## Catatan seam yang sudah ada

- Sidebar sudah mendukung keadaan terkunci: `components/tenant-nav-menu/index.tsx` menghitung
  `disabled = Boolean(item.feature && !features[item.feature])`, menampilkan ikon gembok dan
  tooltip "… dinonaktifkan oleh Provider". Jadi cukup mengisi `feature` di config menu.
- Nama permission di `tenant-rbac-contract.ts` mengikuti operation id, sehingga
  `jadwal.mengajar.load` dan `jadwal.events.load` yang sudah terdaftar dapat dipakai langsung
  sebagai permission menu/pages.
- Registry fitur default **baru** adalah nonaktif (`features[key] === true`); aturan legacy di
  `lib/features/tenant-feature-policy.ts` perlu ditambah bila keputusan default-nya "aktif".

## Acceptance criteria

- [x] Feature key baru di registry: `penjadwalan` (parent) dan `penjadwalanRead`, dengan label/deskripsi Indonesia, functional domain `scheduling`, route `/jadwal/**`, dan `requires` sesuai hierarki.
- [x] `penjadwalanWrite` **belum** dibuat di tiket ini — ditambahkan bersamaan dengan operasi tulis Jadwal Mengajar pertama (slice 04).
- [x] Provider dapat mematikan Penjadwalan per Tenant; parent yang mati menang atas child yang tersimpan aktif (teruji).
- [x] Item menu Penjadwalan terkunci + tooltip saat Provider mematikan; submenu tidak bisa dibuka dari UI (seam existing `feature` di sidebar).
- [x] Halaman `/jadwal/mengajar` dan `/jadwal/events` memblokir akses langsung (URL) ketika fitur mati atau role tidak berhak, dengan perilaku non-disclosure (RBAC existing + `enforceTenantFeatureEnabled`).
- [x] Permission placeholder `tenant.authorization-audit.view` pada menu dan operasi `jadwal.*` diganti seed baru `jadwal.mengajar.view` / `jadwal.events.view` (permission assignable, jadi role non-admin bisa diberi akses kelak); akses tetap School Admin via `context: "school-admin-only"`.
- [x] Default legacy ditetapkan eksplisit dan diuji: `penjadwalan` dan `penjadwalanRead` aktif untuk Tenant tanpa setelan; Provider tetap bisa mematikan kapan saja.
- [x] Tes: parent mati + child tersimpan aktif; child aktif + read; child mati; provider-disabled; permintaan server langsung ditolak (RBAC + feature, teruji di 3 file test).
- [x] `pnpm typecheck` (tanpa error baru), tes fokus (57 pass), dan `pnpm rbac:coverage` — temuan tetap 21, identik dengan baseline (lihat catatan).

## Comments

### 2026-09-27 — implementasi

- `config/tenant-features.ts`: domain `scheduling` + key `penjadwalan` (parent, tanpa
  `requires`) dan `penjadwalanRead` (`requires: ["penjadwalan"]`), routes `/jadwal/**`.
- `lib/features/tenant-feature-policy.ts`: legacy default eksplisit — keduanya aktif
  bila tenant belum pernah menyimpan flag (menu sudah tampil hari ini; akses tidak
  dicabut diam-diam), Provider tetap bisa mematikan.
- `lib/authorization/tenant-rbac-contract.ts`: seed `jadwal.mengajar.view` +
  `jadwal.events.view` (registry 166 → 168), operasi `jadwal.*.load` pindah ke
  permission baru, metadata modul `jadwal` ("Penjadwalan").
- `components/tenant-nav-menu/config.ts`: parent memakai `feature: "penjadwalanRead"`
  + permission `jadwal.*.view` mode any; submenu memakai permission masing-masing.
- Halaman `/jadwal/mengajar` & `/jadwal/events`: `enforceTenantFeatureEnabled(domain,
  "penjadwalanRead")` sebelum evaluasi RBAC.
- Test: policy Penjadwalan (legacy aktif, child mati, parent mati menang), menu
  (permission baru + feature), authorization (daftar admin-only tanpa jadwal),
  rbac-contract (jumlah registry 168 + pemisahan assertion), provider fixture.
- **Catatan jujur `pnpm rbac:coverage`**: skrip keluar exit 1 dengan 21 temuan
  `unmapped-entry-point` (settings/roles/actions dll.) — diverifikasi via `git stash`
  bahwa jumlahnya identik dengan baseline sebelum perubahan ini; tidak ada temuan
  terkait `jadwal/**`. Temuan pra-eksisting ini di luar lingkup tiket 01 dan layak
  jadi tiket tersendiri.
- Dua error `tsc --noEmit` di `*.mysql.test.ts` juga pra-eksisting (migrasi Neon),
  tidak disentuh tiket ini.
