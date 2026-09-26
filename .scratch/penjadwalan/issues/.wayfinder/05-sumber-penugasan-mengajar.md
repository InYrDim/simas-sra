# Tetapkan sumber Penugasan Mengajar

Type: grilling
Status: decided
Decided: 2026-09-27

## Decisions

1. **Lokasi UI** — Halaman pengelolaan Penugasan Mengajar berada di **Master Data**
   (submenu baru). Penugasan Mengajar adalah data referensi lintas fitur (Ulangan sudah
   memakainya; Penjadwalan akan memakainya), dan selaras definisi Master Data di
   `CONTEXT.md`. Awalnya user memilih menu Penjadwalan, lalu **merevisi ke Master Data**
   setelah konsekuensi gating dijelaskan.
2. **Kendali fitur** — Halaman penugasan **tidak terikat feature key Penjadwalan**;
   cukup RBAC School Admin. Alasan: bila Provider mematikan fitur Penjadwalan, Ulangan
   tetap membutuhkan pengelolaan penugasan — jangan ikat data akademik ke gate fitur
   jadwal. Menu Penjadwalan tetap berisi Jadwal Mengajar (slot) + Events.
3. **Lifecycle di UI** — **Full lifecycle** sesuai modul domain existing
   (`lib/academic/teaching-assignment.ts`): buat sebagai `planned` → Aktifkan →
   Akhiri / Batalkan / **Ganti Guru (replace)**. Semua transisi wajib alasan dan
   tercatat di `teaching_assignment_event` (sudah didesain demikian; UI hanya
   memasang tombol + form alasan).
4. **Form Slot Jadwal** — Form slot **memilih satu Penugasan Mengajar aktif**
   (dengan filter rombel/tahun/semester) dan menyediakan **tautan ke Master Data**
   untuk membuat penugasan baru. **Tidak ada pembuatan penugasan dari form slot** —
   satu sumber kebenaran, tanpa duplikasi logika lifecycle di dua tempat.
5. **Impor massal** — **Ditunda**. Slice ini hanya CRUD + lifecycle via UI manual
   Master Data; impor massal (mis. memperluas pola Batch Impor Orang) menjadi tiket
   tersendiri bila kebutuhannya terbukti.
6. **Kewenangan** — **Hanya School Admin** mengelola penugasan (konsisten dengan
   tiket 03). Guru hanya konsumen: melihat penugasannya sendiri — mekanisme bacanya
   sudah ada (`listEffectiveTeachingAssignmentsForUser`). Permission tulis baru
   khusus School Admin.

## Implikasi

- **Blokade CRUD Jadwal Mengajar terangkat**: prasyaratnya kini jelas — buat penugasan
  dulu di Master Data, lalu slot memilihnya.
- Slice baru "Penugasan Mengajar" di Master Data: submenu + halaman (list per Tahun
  Ajaran/Rombel/Guru, form buat, aksi lifecycle dengan alasan, riwayat event).
- RBAC: operasi + permission tulis penugasan baru (School Admin); masuk rbac contract
  + coverage; permission juga dipakai halaman Master Data baru ini.
- Form Slot Jadwal (menu Penjadwalan) mengonsumsi daftar penugasan aktif + link
  antar-menu.

## Question (asli, untuk jejak)

Slot Jadwal merujuk Penugasan Mengajar, tetapi Penugasan Mengajar belum punya UI —
dari mana datanya berasal sebelum sekolah bisa menyusun jadwal?

1. **UI baru** di Master Data (dipilih).
2. Sambil menyusun jadwal — ditolak (duplikasi lifecycle).
3. Impor — ditunda ke tiket tersendiri.
