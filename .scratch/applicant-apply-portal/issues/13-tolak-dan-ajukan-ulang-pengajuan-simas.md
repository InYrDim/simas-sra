# 13 — Tolak dan ajukan ulang Pengajuan SIMAS

**What to build:** Provider Admin dapat menolak Pengajuan pending dengan alasan wajib. Pemohon melihat alasan dan seluruh snapshot historis, lalu dapat langsung mengirim Pengajuan baru untuk NPSN yang sama sebagai attempt berikutnya tanpa membuka atau mengubah record lama.

**Blocked by:** 12 — Kirim Pengajuan pertama dan pantau status pending.

**Status:** ready-for-agent

- [ ] Provider Admin dapat menolak hanya Pengajuan yang masih pending dan wajib memberikan alasan nonkosong.
- [ ] Rejection mencatat Provider Admin dan waktu keputusan serta melakukan update bersyarat pending→rejected.
- [ ] Retry rejection identik bersifat idempoten; keputusan berbeda atau keputusan terhadap record final menghasilkan conflict tanpa menimpa hasil lama.
- [ ] `/apply` menampilkan alasan rejection, snapshot rejected yang immutable, dan seluruh history berurut attempt number.
- [ ] Pemohon rejected dapat langsung membuka form Pengajuan baru tanpa masa tunggu atau batas percobaan.
- [ ] Resubmit hanya menerima NPSN canonical yang sudah terikat dan membuat record baru dengan attempt number monotonik berikutnya.
- [ ] Pengajuan rejected lama tidak diedit, dibuka kembali, atau dihapus ketika resubmit berhasil.
- [ ] Maksimal satu pending per binding tetap berlaku selama resubmit bersamaan.
- [ ] Submit dan rejection memakai urutan lock kanonis serta memvalidasi ulang state setelah lock.
- [ ] Test MySQL nyata mencakup retry rejection, final-decision conflict, concurrent resubmit, dan reject-versus-submit dengan tepat satu hasil legal serta tanpa record parsial.
