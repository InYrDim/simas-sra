# 08 — Kelola lifecycle dan archive Siswa

**What to build:** Tambahkan action khusus untuk perubahan status, koreksi kelulusan, archive, dan reactivation Profil Siswa tanpa menghapus history.

**Blocked by:** 07 — Kelola identitas Warga Sekolah dan Siswa.

**Status:** ready-for-agent

- [ ] Siswa Aktif dapat berubah menjadi Lulus, Pindah, atau Keluar dengan effective date dan alasan/catatan yang diwajibkan.
- [ ] Siswa Pindah atau Keluar dapat diterima kembali sebagai Aktif melalui history baru.
- [ ] Lulus tidak dapat diubah melalui edit biasa; koreksi memakai action khusus dengan alasan dan before/after audit.
- [ ] Effective date tidak boleh sebelum entry date dan periods tidak boleh tumpang tindih.
- [ ] Scheduled future status change tidak tersedia.
- [ ] Profil Siswa hanya dapat diarsipkan setelah Lulus, Pindah, atau Keluar.
- [ ] Active relationship menolak archive dan UI menampilkan setiap blocker; active account hanya warning.
- [ ] Archived profile read-only dan tidak dapat dipakai untuk relationship baru.
- [ ] Reactivation mengulang uniqueness/relationship validation tanpa memulihkan status atau relationship lama.
- [ ] Semua transition, denial, conflict, archive, dan reactivation memiliki command dan MySQL tests.
