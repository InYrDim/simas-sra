# Tetapkan dampak Penjadwalan ke Riwayat, rekap, dan notifikasi per pelajaran

Type: grilling
Status: decided
Decided: 2026-09-28

## Decisions

1. **Riwayat per sesi/pelajaran** — Riwayat Absensi menampilkan setiap sesi Kelas
   sebagai baris sendiri dengan konteks slot (jam, Mapel, Guru, Rombel); detail expand
   menampilkan record sesi itu. Model data sudah per-sesi sehingga tidak perlu agregasi
   harian bertingkat. Lapisan Gerbang tampil seperti sekarang (satu sesi/hari); kolom
   konteks Kelas kosong untuk Gerbang.
2. **Rekap: konteks + agregat per mapel per semester** — semua tampilan record Kelas
   (Riwayat, Absensi Saya) mendapat konteks per pelajaran via join sesi→slot→penugasan,
   **plus** metrik agregat kehadiran per mapel per semester untuk wali/guru/admin.
   Atribusi guru pada rekap bergantung pada keputusan guru pengganti (tiket 10) —
   bagian agregat dikerjakan setelah tiket 10 atau dengan atribusi "pengampu slot".
3. **Notifikasi WhatsApp: model C** — record manual kirim WA langsung (arsitektur
   `sendAttendanceNotification` tak berubah); saat penutupan sesi, hanya siswa yang
   **belum tercatat** (terisi alpa otomatis oleh sistem) yang menerima notifikasi —
   siswa yang sudah dicatat Guru tidak dobel kirim. Template per-mode bertambah
   placeholder `{mapel}`, `{jam}`, `{guru}`. Dedup dengan Gerbang: pesan tetap terpisah
   per layer (template & konteks berbeda), tidak digabung pesan harian.
4. **Alpa otomatis diberi badge "Otomatis"** — di Riwayat & rekap, record alpa hasil
   sistem (`recordedByUserId` NULL) diberi penanda kecil berbeda dari alpa buatan
   Guru/Admin. Hanya tampak untuk Guru/Admin; siswa/wali tidak melihat badge. Tidak ada
   perubahan model — data penandanya sudah ada.
5. **Toleransi penutupan tetap global per tenant** — satu `kelasCloseToleranceMinutes`
   untuk semua slot; variasi per slot tidak dibuat (kebutuhan belum terbukti; kolom
   opsional bisa ditambah aditif nanti bila muncul).

## Implikasi

- Query riwayat baru: join `attendance_record`/`attendance_session` → `teaching_slot`
  → `teaching_assignment` (→ subject/classGroup/schoolPerson) untuk konteks pelajaran;
  lapisan Gerbang tidak tersentuh perilakunya.
- `sendAttendanceNotification` perlu konteks sesi (mapel/jam/guru) dan jalur kirim
  terpisah untuk auto-alpa saat penutupan (dipanggil dari close path, bukan dari
  record fill).
- Rekap agregat semester: group-by (siswa, mapel, semester aktif) dari record Kelas
  ber-sesi; sumber kebenaran atribusi guru mengikuti tiket 10.
- Test: query riwayat/rekap baru + regresi tampilan Gerbang + dedup notifikasi
  (siswa tercatat tidak dikirim ulang saat close).

## Question (asli, untuk jejak)

Setelah sesi Absensi Kelas berjalan per pelajaran, bagaimana Riwayat, rekap, dan
notifikasi WhatsApp menyesuaikan model per-slot: tampilan riwayat per sesi vs agregat
harian, metrik rekap baru, pemicu/isi/penerima/dedup notifikasi, pembedaan alpa
otomatis dari alpa manual, dan granularitas toleransi penutupan?
