# Tetapkan relokasi pengaturan Jadwal Sekolah

Type: grilling
Status: decided
Decided: 2026-09-27

## Decisions

1. **Relokasi** — Pengaturan Jadwal Sekolah (jam masuk/pulang per hari efektif + hari
   libur) **dipindah ke menu Penjadwalan** sebagai submenu **Jadwal Sekolah**
   (mis. `/jadwal/sekolah`), bersama Jadwal Mengajar dan Events. Worker lapisan
   Gerbang **tidak berubah sama sekali** — hanya UI-nya yang pindah.
2. **Rute lama** — `/absensi/settings/schedule` **dihapus tanpa redirect**: halaman
   dan kartu "Jadwal Sekolah (Gerbang)" di hub Pengaturan Absensi dihapus;
   `revalidatePath` di actions diarahkan ke path baru. Fitur ini belum lama ada, jadi
   risiko bookmark rusak dianggap kecil.
3. **Feature gate** — Halaman **tetap digate `absensiGerbang`** (bukan fitur
   Penjadwalan): gate mengikuti pemilik data. Menonaktifkan Penjadwalan tidak boleh
   mengunci konfigurasi jadwal Gerbang. Item menu berada di bawah Penjadwalan tetapi
   feature-nya absensiGerbang — perlu dicek bahwa sidebar mendukung feature per item
   (sudah: config menu punya kolom `feature` per item).
4. **Nama & istilah** — Submenu berlabel **"Jadwal Sekolah"**; istilah dicatat kanonik
   di `CONTEXT.md`. Halaman tetap menjelaskan bahwa jadwal ini dipakai absensi Gerbang
   agar pengguna tidak kehilangan konteks.
5. **Permission** — Operasi **baru `jadwal.sekolah.*`** + permission baru (bukan lagi
   `absensi.settings.save` → `absensi.settings.update`). Konsekuensi migration role
   ditangani dengan **grant otomatis sekali jalan** ke role yang memuat
   `absensi.settings.update`; **Template Role Tenant diperbarui** untuk role baru —
   akses School Admin tidak berubah, tidak ada kehilangan akses diam-diam.

## Implikasi

- Slice relokasi: halaman baru `/jadwal/sekolah` (gate `absensiGerbang`, operasi
  `jadwal.sekolah.*`), hapus halaman + kartu lama, arahkan `revalidatePath`, tambah
  item menu, dan entrypoint RBAC baru.
- Migration role: grant sekali jalan ke role terkait + update template role (pola yang
  perlu dicek cara existing-nya di modul role/template).
- Istilah kanonik "Jadwal Sekolah" masuk `CONTEXT.md`.

## Question (asli, untuk jejak)

Pengaturan Jadwal Sekolah (jam masuk/pulang per hari + tanggal libur) sekarang berada
di Pengaturan Absensi (`/absensi/settings/schedule`) dan dipakai worker lapisan
Gerbang. Apakah dipindahkan ke menu Penjadwalan, tetap di Pengaturan Absensi, atau
ditunda dulu?
