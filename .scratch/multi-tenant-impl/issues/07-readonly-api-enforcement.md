# 07 — Read-Only API Enforcement

**What to build:** Penegakan hukum bahwa akun yang habis masa trialnya tidak bisa melakukan perubahan data. Semua Server Actions atau API Route untuk mutasi ditolak (mengembalikan error). Termasuk menambahkan satu form dummy untuk membuktikannya.

**Blocked by:** 06 — Trial State UI (Banner)

**Status:** ready-for-agent

- [ ] Dibuat sebuah wrapper atau utilitas middleware (misal `tenantProtectedAction`) yang mengecek status trial.
- [ ] Jika kedaluwarsa, wrapper membatalkan aksi dan me-return status 403 (atau setara).
- [ ] Terdapat komponen form "Tambah Data" sederhana yang akan terblokir dan memunculkan toast/pesan error saat di-submit dalam keadaan read-only.
