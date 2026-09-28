# Tetapkan kontrak Slot Jadwal

Type: grilling
Status: decided
Decided: 2026-09-27

## Decisions

1. **Representasi waktu** — Slot Jadwal menyimpan `startTime`/`endTime` eksplisit
   ("HH:MM", selaras `school_schedule_day` dan `attendance_session.plannedStart/End`).
   Ditambah **tabel periode jam pelajaran per Tenant** sebagai *preset pengisi form*
   saat membuat slot — alat bantu pengisian saja, **bukan dependensi runtime**: slot
   tidak ber-FK ke periode.
2. **Keterikatan** — Slot wajib merujuk satu **Penugasan Mengajar** (FK tenant-scoped
   komposit, pola yang sama dengan FK existing). Slot berlaku untuk tanggal *d* hanya
   bila penugasannya berstatus `active` dan `startsOn ≤ d < endsOn (atau NULL)`.
   Penugasan diakhiri → slot **tetap ada tetapi tidak berlaku** (ditandai perlu
   penanganan, tidak membuka sesi); repoint ke penugasan baru dilakukan **manual**.
3. **Periode berlaku** — Ikatan Tahun Ajaran **mengalir lewat penugasan** (slot tidak
   punya kolom tahun ajaran sendiri). Slot punya **flag Semester** (`ganjil | genap`,
   diupayakan selaras `academic_semester` yang sudah ada) dan divalidasi terhadap
   semester Tahun Ajaran penugasan saat menyimpan. Ganti tahun = penugasan baru →
   susun slot baru; jadwal lama jadi riwayat.
4. **Konflik** — **Guru dobel** (dua rombel pada jam sama) dan **Rombel dobel** (dua
   pelajaran pada jam sama) keduanya **hard ditolak** saat menyimpan. Cek berupa
   *overlap rentang waktu* (bukan kesamaan persis) dalam lingkup Tahun Ajaran +
   Semester; saat edit, slot yang sedang diedit dikecualikan. Rombongan Belajar
   gabung belum diakomodasi (kebutuhan khusus menyusul).
5. **Guru pengganti** — Ditunda ke slice berikutnya. Kebutuhan mendesak ditangani
   lewat operasi `replaced` pada Penugasan Mengajar yang sudah ada.
6. **Lokasi/Ruang** — Ditunda; slot **tanpa kolom ruang**. Ruang cukup dari Lokasi
   utama Rombongan Belajar yang sudah ada.
7. **Siklus hidup** — Slot **langsung berlaku saat disimpan**; tanpa status
   draf/terbit. Perubahan jadwal hanya berdampak ke sesi absensi berikutnya (sesi
   dibuat per tanggal mengikuti slot yang berlaku hari itu).
8. **Istilah kanonik** — **Jadwal Mengajar** = kumpulan Slot Jadwal milik satu
   Rombongan Belajar untuk satu Tahun Ajaran (+Semester); **Slot Jadwal** = satu
   pertemuan mingguan yang merujuk satu Penugasan Mengajar aktif. Dicatat di
   `CONTEXT.md` lewat `/domain-modeling`.
9. **Kewenangan** — **Hanya School Admin** menyusun jadwal (buat/edit/hapus slot);
   `penjadwalanWrite` khusus School Admin. Akses baca Guru ke jadwalnya ditentukan
   tiket 04.

## Implikasi

- Tiket 05 (sumber Penugasan Mengajar) makin penting: slot wajib merujuk penugasan
  aktif, jadi admin tidak bisa menyusun jadwal sebelum penugasan ada — sumber
  penugasan harus jelas sebelum slice CRUD Jadwal Mengajar.
- Skema baru: tabel slot + tabel periode (preset); keduanya tenant-scoped.
- Cek konflik Guru dan Rombel wajib ada di layer tulis, bukan hanya UI.

## Question (asli, untuk jejak)

Tentukan kontrak **Jadwal Mengajar** sampai skema dan UI bisa dibangun tanpa asumsi:

1. **Representasi waktu** — jam eksplisit "HH:MM" vs nomor jam pelajaran + tabel periode.
2. **Keterikatan** — wajib merujuk Penugasan Mengajar? Efek saat penugasan berakhir/diganti?
3. **Periode berlaku** — per Tahun Ajaran/Semester atau berulang tanpa periode?
4. **Konflik** — Guru dobel dan/atau Rombel dobel: ditolak atau peringatan?
5. **Guru pengganti** — override harian, atau di luar lingkup awal?
6. **Lokasi/Ruang** — kolom opsional atau ditunda?
7. **Siklus hidup** — langsung berlaku atau draf/terbit?
8. **Istilah kanonik** — Jadwal Mengajar / Slot Jadwal.
9. **Kewenangan** — siapa yang menyusun jadwal?
