# 11 — Kelola Warga Sekolah yang memiliki beberapa profil

**What to build:** Lengkapi perilaku aggregate Warga Sekolah ketika satu orang memiliki lebih dari satu Profil Siswa, Guru, atau Staf.

**Blocked by:** 08 — Kelola lifecycle dan archive Siswa; 09 — Kelola Profil Guru; 10 — Kelola Profil Staf dan riwayat jabatan.

**Status:** ready-for-agent

- [ ] Satu Warga Sekolah dapat memiliki maksimal satu profil dari setiap jenis dan beberapa jenis profil sekaligus.
- [ ] Edit shared personal data dari satu profile terlihat dari semua profile orang yang sama.
- [ ] UI memberi tahu profil lain yang akan terpengaruh sebelum menyimpan shared data.
- [ ] NIP correction berlaku ke semua konteks dan menyimpan before/after audit.
- [ ] Akun Pengguna tetap maksimal satu, opsional, dan Tenant yang sama; Master Data tidak mengubah link tersebut.
- [ ] Warga Sekolah tidak otomatis archived ketika profile diarsipkan.
- [ ] Action archive Warga Sekolah hanya berhasil setelah semua profile archived.
- [ ] Reactivation profile dapat mengaktifkan Warga Sekolah setelah uniqueness check, tetapi tidak profile/relationship lain.
- [ ] Identifier Warga Sekolah tetap dicadangkan setelah archive.
- [ ] Multi-profile creation, duplicate prevention, shared edits, archive/reactivation, and cross-Tenant tests pass.
