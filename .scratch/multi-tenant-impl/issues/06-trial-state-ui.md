# 06 — Trial State UI (Banner)

**What to build:** Indikator visual secara global (pada layout tenant) yang memberi tahu pengguna status akun mereka. Jika trial masih berjalan, mungkin tidak muncul, namun jika masa trial habis, sebuah banner peringatan mencolok akan tampil.

**Blocked by:** 05 — Tenant Onboarding

**Status:** done

- [x] Komponen banner UI yang mengecek `tenant.trial_ends_at` vs waktu sekarang.
- [x] Banner dirender di `app/(tenant)/[domain]/layout.tsx` sehingga muncul di semua halaman tenant tersebut.
- [x] Jika diuji dengan mengubah tanggal trial di DB ke masa lalu, banner otomatis terlihat.
