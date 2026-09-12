# 06 — Buka kembali Tenant dengan subscription baru

**What to build:** School Admin dapat meminta Pembukaan Kembali dan Provider Admin dapat menyetujui, menolak, atau memulainya sendiri. Tenant baru kembali aktif setelah subscription baru berhasil dibuat; kegagalan aktivasi tetap dapat dilanjutkan secara aman.

**Blocked by:** 04 — Kelola Masa Tunggu Penghapusan dan kesiapan akhir; 05 — Tegakkan akses Tenant yang ditutup secara terpusat.

**Status:** ready-for-agent

- [ ] School Admin dapat meminta Pembukaan Kembali dengan alasan dan autentikasi ulang.
- [ ] Request menjadi `pending_reopening_review`, memblokir deletion, dan tidak memindahkan deadline.
- [ ] Provider dapat menolak dengan alasan; kasus kembali ke waiting atau ready berdasarkan deadline asli.
- [ ] Provider dapat menyetujui dengan catatan opsional atau memulai reopening sebelum deletion dimulai.
- [ ] Approval membatalkan jadwal lama dan masuk `reopening_activation_pending`.
- [ ] Tenant tetap `closed` sampai subscription baru aktif.
- [ ] Aktivasi sukses atomik membuat subscription baru, menandai `reopened`, dan mengaktifkan Tenant.
- [ ] Aktivasi gagal mempertahankan state pending tanpa menghidupkan kembali jadwal lama.
- [ ] Retry idempotent dan tidak membuat dua subscription.
- [ ] Reopening tidak memulihkan kredensial revoked/expired atau me-replay pekerjaan yang terlewat.
- [ ] Invalidation selesai sebelum akses aktif dianggap pulih.
