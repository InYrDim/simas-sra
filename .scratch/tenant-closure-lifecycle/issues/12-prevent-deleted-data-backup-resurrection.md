# 12 — Cegah data Tenant terhapus hidup kembali dari backup

**What to build:** Sediakan restore gate executable yang membaca Daftar Penekanan Penghapusan sebelum environment hasil restore menerima traffic, membersihkan ulang data terhapus, menjalankan verifier, menegakkan retensi backup, dan melacak dua milestone permanensi.

**Blocked by:** 11 — Finalisasi bukti dan dukungan pascapenghapusan.

**Status:** ready-for-agent

- [ ] Daftar Penekanan Penghapusan berada di luar ordinary backup cycle dan hanya menyimpan identifier pseudonim minimum.
- [ ] Environment restore dimulai terisolasi tanpa traffic.
- [ ] Restore gate menghapus ulang Tenant suppressed dan menjalankan deletion-boundary verifier.
- [ ] Missing suppression data, cleanup failure, atau verifier failure memblokir activation.
- [ ] Copy atau media migration mempertahankan original backup creation time.
- [ ] Backup tanpa legal hold berusia maksimum 90 hari dari waktu pembuatan asli.
- [ ] Legal hold hanya menunda destruction dan tidak membuka akses operasional.
- [ ] Penghapusan Tenant selesai dibedakan dari Permanen di seluruh penyimpanan.
- [ ] Evidence pemusnahan backup dapat diperbarui tanpa memulihkan Tenant.
- [ ] Prosedur dibuktikan melalui executable check atau restore rehearsal.
