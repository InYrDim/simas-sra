# 08 — Konfirmasi Penghapusan Tenant secara atomik

**What to build:** Provider Admin mendapatkan layar konfirmasi akhir dengan checklist blocker live. Konfirmasi yang lolos memasang deletion fence, menutup penerimaan ekspor, dan membuat tepat satu Eksekusi Penghapusan Tenant secara atomik tanpa mengklaim data sudah dihapus.

**Blocked by:** 04 — Kelola Masa Tunggu Penghapusan dan kesiapan akhir; 05 — Tegakkan akses Tenant yang ditutup secara terpusat; 06 — Buka kembali Tenant dengan subscription baru; 07 — Hasilkan dan unduh Paket Ekspor Tenant.

**Status:** ready-for-agent

- [ ] Layar menjelaskan penghapusan sistem aktif dan retensi backup secara akurat dan accessible.
- [ ] Konfirmasi memerlukan Provider authority terkini, autentikasi ulang, dan identitas Tenant yang cocok.
- [ ] Pemeriksaan atomik mencakup kasus ready, Tenant closed, tidak ada reopening/export blocker, subscription inactive, tidak ada invoice generation, eksekusi lain, atau legal hold relevan.
- [ ] Utang tidak menjadi blocker.
- [ ] Satu transaksi mengunci state, menghentikan acceptance ekspor, memasang fence, membuat eksekusi/checkpoint, menulis audit, dan menerbitkan outbox.
- [ ] Jika blocker atau write gagal, data Tenant tetap utuh dan acceptance ekspor dapat dilanjutkan.
- [ ] Race export/reopening/deadline change versus confirmation menghasilkan outcome deterministik.
- [ ] Dua konfirmasi concurrent menghasilkan satu eksekusi aktif.
- [ ] Retry identik mengembalikan eksekusi yang sama.
- [ ] Semua writer existing menolak side effect setelah fence aktif.
