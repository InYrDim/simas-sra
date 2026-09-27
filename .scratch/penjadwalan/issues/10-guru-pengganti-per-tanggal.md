# 10 — Guru pengganti per tanggal pada Slot Jadwal

**What to build:** Saat guru pengampu berhalangan (sakit, dinas, rapat), Slot Jadwal
yang merujuk Penugasan Mengajar tetap menunjuk guru asli. Izinkan School Admin
menetapkan **guru pengganti per tanggal** pada slot — mengubah siapa yang mencatat
absensi sesi Kelas di tanggal tersebut, tanpa mengubah Penugasan Mengajar induk.

**Blocked by:** None (tiket 03, 04, 05, 06 sudah resolved).

**Status:** needs-triage

## Konteks keputusan yang sudah ada

- Slot menyimpan FK wajib ke Penugasan Mengajar aktif (repoint manual saat berakhir);
  konflik Guru & Rombel hard ditolak; guru pengganti **ditunda** pada wayfinder 03.
- Sesi Kelas unik per (slot, tanggal) dan immutable; guard tulis
  `assertKelasSessionWriteAccess` mengizinkan pengampu, Admin, dan wali kelas
  read-only — identitas pengampu saat ini diturunkan dari Penugasan Mengajar di slot.
- Tersedia operasi `replaced` pada lifecycle Penugasan Mengajar untuk pergantian
  permanen; ini bukan pengganti kebutuhan harian.

## Pertanyaan desain yang harus dijawab

- Model data: tabel override `(slot_id, tanggal, guru_pengganti)` terpisah, atau
  kolom opsional di sesi? Bagaimana dengan tanggal tanpa sesi yang belum dibuat?
- Apakah pengganti juga boleh dari luar rombel/guru mapel lain?
- Konflik jadwal: apakah jadwal pengganti di tanggal sama diperiksa konfliknya?
- Siapa yang boleh menetapkan (cukup School Admin, atau Kepala Sekolah juga)?
- Sesi yang sudah terbuka/tertutup di tanggal itu — bisa dipindah pengampunya atau
  harus dihapus-buat ulang (immutable)?
- Rekap per pelajaran (tiket 09): status mengajar guru asli vs pengganti dihitung
  bagaimana?

## Acceptance criteria

- [ ] Keputusan model data & UX terekam di wayfinder/map.md.
- [ ] School Admin dapat menetapkan/membatalkan guru pengganti per slot per tanggal.
- [ ] Sesi Kelas pada tanggal tersebut mencatat atas nama pengganti (guard tulis
      mengenali pengganti) tanpa melanggar immutability record.
- [ ] Cek konflik jadwal memperhitungkan override (jika diputuskan perlu).
- [ ] Test: guard akses pengganti, idempotensi sesi, dan konflik jadwal.

## Comments
