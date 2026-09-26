# Tetapkan perilaku sesi Absensi Kelas per pelajaran

Type: grilling
Status: decided
Decided: 2026-09-27

## Decisions

1. **Identitas sesi** — Sesi merujuk **Slot Jadwal**: kolom `slotId` (FK tenant-scoped)
   + `sessionDate`, unik per `(tenant, slotId, sessionDate)` di level DB, sehingga sesi
   dobel dicegah oleh DB. Guru/Mata Pelajaran/Rombongan Belajar **mengalir dari slot →
   penugasan**, tidak disimpan di sesi. Validasi penugasan aktif tetap dilakukan saat
   membuka sesi (FK saja tidak menolak penugasan yang sudah berakhir).
2. **Buka/tutup sesi** — **Otomatis sebagai default + manual untuk koreksi**:
   - Worker (pola Gerbang: keputusan murni `before/during/after` + aksi worker) membuka
     sesi saat masuk jendela slot dan menutupnya di akhir jendela + toleransi.
   - Admin/Guru tetap bisa menutup lebih awal atau membuka manual di luar jendela.
3. **Siapa yang mencatat** — **Guru pengampu** pelajaran itu + **School Admin**
   (koreksi semua sesi). Wali Kelas hanya melihat. Implikasi: Guru butuh akses **baca
   jadwalnya sendiri** + permission **tulis record Kelas**; dicatat di map untuk slice
   RBAC/implementasi.
4. **Perubahan jadwal setelah sesi terbentuk** — Sesi dan record **immutable**:
   dibiarkan apa adanya (audit utuh). Slot yang sudah punya sesi **diblokir dari
   penghapusan**; admin mengedit jam/waktu, atau menghapus sesi terkait lewat alur
   terpisah. Perubahan slot hanya berdampak ke sesi berikutnya (sesi lahir per tanggal
   mengikuti slot yang berlaku saat itu).
5. **Data sesi Kelas lama** — **Dihapus** (keputusan destruktif, sadar; belum ada data
   produksi): migrasi sekali menghapus sesi lapisan Kelas beserta `attendance_record`-nya.
   Konsep "sesi harian" (tanpa Mata Pelajaran) **hilang dari produk**. Aturan unik
   `attendance_session (tenant, layer, sessionDate)` diganti `(tenant, slotId,
   sessionDate)` untuk lapisan Kelas; lapisan Gerbang tetap unik per tanggal. Riwayat
   masa lalu hanya menyisakan lapisan Gerbang.
6. **Jendela sesi** — `plannedStart/plannedEnd` = `startTime/endTime` slot, plus
   **toleransi N menit** setelah jam selesai untuk penutupan otomatis (Pengaturan
   Absensi, per Tenant; usulan default 10 menit). Buka tetap tepat jam mulai slot.
7. **Status kehadiran** — Tetap `hadir|izin|sakit|alpa` manual; siswa yang belum
   dicatat saat sesi ditutup (oleh worker atau manual) diisi **alpa otomatis** oleh
   sistem (actor sistem, mirip pola `openedByUserId NULL`), dan tetap dapat dikoreksi
   Guru/Admin setelahnya. Tanpa penurunan otomatis dari lapisan Gerbang di slice ini.
8. **Tampilan hari ini** — **Per Guru**: default login Guru menampilkan daftar
   pelajarannya hari ini dari jadwal. School Admin dapat memilih sudut pandang **per
   Guru atau per Rombongan Belajar** untuk supervisi.

## Implikasi

- Skema: `attendance_session` + kolom `slotId` (nullable untuk Gerbang, NOT NULL untuk
  Kelas — detail dicek saat implementasi), unique baru per slot+tanggal, migrasi
  pembersihan data Kelas lama.
- Worker penjadwalan perlu diperluas: putaran Kelas per slot (pola `resolve...Decision`
  murni + worker), dengan recheck feature key `penjadwalan` (tiket 02).
- Permission baru: tulis record Kelas untuk Guru pengampu + School Admin; baca jadwal
  untuk Guru. Masuk rbac contract + coverage.
- Pengaturan baru: toleransi penutupan (menit) di Pengaturan Absensi, per Tenant.
- Halaman Absensi Kelas dirombak ke sudut pandang per Guru (default) dengan toggle
  per Rombel untuk School Admin.

## Question (asli, untuk jejak)

Setelah sesi Absensi Kelas terikat ke pelajaran, tentukan perilakunya:

1. **Identitas sesi** — slot vs kombinasi tanggal+Rombel+Mapel+Guru; pencegahan dobel.
2. **Buka/tutup sesi** — otomatis worker, manual, atau keduanya.
3. **Siapa yang mencatat** — Guru pengampu, Wali Kelas, atau School Admin.
4. **Perubahan jadwal setelah sesi terbentuk** — sesi lama dibiarkan, ditandai, dipindah.
5. **Data sesi Kelas lama** — tampil, dimigrasikan, atau dihapus.
6. **Jendela sesi** — jam slot sebagai `plannedStart/plannedEnd`, dengan/tanpa toleransi.
7. **Status kehadiran** — status manual; auto-alpa saat tutup; penurunan dari Gerbang.
8. **Tampilan hari ini** — per Guru, per Rombel, atau keduanya.
