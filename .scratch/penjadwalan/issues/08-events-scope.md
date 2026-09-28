# 08 — Cakupan submenu Events di Penjadwalan

**What to build:** Tentukan dan bangun isi submenu **Events** (`/jadwal/events`) yang
selama ini placeholder — sejak tiket 01 menu sudah tergate `penjadwalanRead` dan
permission `jadwal.events.view`, tetapi halamannya belum punya konten fungsional.

**Blocked by:** None (independen; halaman & RBAC menu sudah disiapkan tiket 01).

**Status:** wontfix (ditunda user 2026-09-28 — bisa dibuka kembali nanti)

## Keputusan 2026-09-28 (sebelum ditunda)

- Q1 cakupan: user memilih **skip dulu** — submenu Events tetap placeholder, tidak
  dikerjakan pada effort Penjadwalan ini. Rekomendasi cakupan minimal (event yang
  mengubah hari efektif: libur non-resmi, upacara, ujian; bukan ekstrakurikuler/rapat)
  tercatat di sini sebagai titik mulai bila nanti dibuka lagi.

## Konteks keputusan yang sudah ada

- Wayfinder 02: Penjadwalan digate Provider per Tenant via feature `penjadwalanRead`;
  halaman `/jadwal/events` sudah memblokir akses langsung (feature + RBAC) dengan
  perilaku non-disclosure.
- Menu sidebar sudah memakai permission `jadwal.events.view`; operasi
  `jadwal.events.load` sudah terdaftar di contract `tenant-operations@7`.
- Luas cakupan Events **belum pernah diputuskan** — ini keputusan wayfinder yang
  harus diambil sebelum implementasi (tipe tiket: keputusan → lalu tiket implementasi).

## Pertanyaan desain yang harus dijawab

- Event apa yang masuk: libur sekolah non-`school_schedule_holiday`, ujian, kegiatan
  (upacara, rapat, parenting), ekstrakurikuler? Batasannya terhadap "Out of scope"
  Penjadwalan (ekstrakurikuler & kegiatan non-pelajaran sedang ditunda).
- Apakah Events mengubah perilaku sesi Absensi Kelas / Gerbang pada tanggal tersebut
  (mis. hari bebas otomatis tanpa sesi)?
- Relasi dengan Jadwal Mengajar: perlu pembatalan slot otomatis atau cukup catatan?
- RBAC: cukup `school-admin-only`, atau perlu operasi tulis baru `jadwal.events.*`?
- Feature gate: ikut `penjadwalanRead` atau feature sendiri?

## Acceptance criteria (keputusan)

- [ ] Keputusan cakupan Events terekam di wayfinder baru (map.md Decisions-so-far
      terupdate) sebelum tiket implementasi dibuat.
- [ ] Tiket implementasi graduates dari "Not yet specified" dengan kontrak data,
      RBAC, dan interaksi sesi absensi yang jelas.

## Comments
