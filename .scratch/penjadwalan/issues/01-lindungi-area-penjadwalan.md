# 01 — Lindungi dan siapkan area Penjadwalan

**What to build:** Area Penjadwalan (`/jadwal/**`) menjadi fitur Tenant yang dapat
dikendalikan Provider per Tenant, dengan RBAC sungguhan menggantikan permission placeholder
audit yang sekarang dipakai menu dan operasi `jadwal.*`.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

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

- [ ] Feature key baru di registry: `penjadwalan` (parent) dan `penjadwalanRead`, dengan label/deskripsi Indonesia, functional domain, route `/jadwal/**`, dan `requires` sesuai hierarki.
- [ ] `penjadwalanWrite` **belum** dibuat di tiket ini — tambahkan bersamaan dengan operasi tulis Jadwal Mengajar pertama agar tidak ada key tanpa fungsi produk.
- [ ] Provider dapat mematikan Penjadwalan per Tenant; parent yang mati menang atas child yang tersimpan aktif.
- [ ] Item menu Penjadwalan terkunci + tooltip saat Provider mematikan; submenu tidak bisa dibuka dari UI.
- [ ] Halaman `/jadwal/mengajar` dan `/jadwal/events` memblokir akses langsung (URL) ketika fitur mati atau role tidak berhak, dengan perilaku non-disclosure.
- [ ] Permission placeholder `tenant.authorization-audit.view` pada menu dan operasi `jadwal.*` diganti `jadwal.mengajar.load` / `jadwal.events.load`; akses tetap School Admin sampai tiket perilaku sesi menentukan akses Guru.
- [ ] Default legacy ditetapkan eksplisit dan diuji. Rekomendasi: `penjadwalan` dan `penjadwalanRead` aktif untuk Tenant tanpa setelan (menu sudah tampil hari ini dan halaman masih placeholder, jadi jangan hilangkan akses secara diam-diam); Provider tetap bisa mematikan kapan saja.
- [ ] Tes: child aktif + lifecycle writable; child aktif + read-only; child mati; parent mati saat child tersimpan aktif; alasan `provider-disabled` menang; permintaan server langsung tetap ditolak.
- [ ] `pnpm typecheck`, tes fokus, dan `pnpm rbac:coverage` hijau.
