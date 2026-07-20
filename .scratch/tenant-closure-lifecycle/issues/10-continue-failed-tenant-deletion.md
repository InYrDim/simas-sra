# 10 — Lanjutkan Penghapusan Tenant yang gagal

**What to build:** Kegagalan parsial menjadi state operasional aman yang dapat dilanjutkan Provider Admin pada eksekusi yang sama. Fence tetap aktif, checkpoint sukses dipertahankan, dan tidak ada jalan menuju reopening atau rollback data.

**Blocked by:** 09 — Jalankan Penghapusan Tenant sampai terverifikasi bersih.

**Status:** ready-for-agent

- [ ] Kegagalan cleanup/verifier menghasilkan `deletion_failed` dan evidence error yang aman.
- [ ] `deletion_failed` tidak kedaluwarsa, tidak dapat dibatalkan, dan tidak membuka Tenant.
- [ ] Deletion fence tetap aktif tanpa expiry.
- [ ] Provider melihat lokasi gagal, attempt terakhir, dan tindakan Lanjutkan Penghapusan.
- [ ] Continuation memerlukan authority terkini, autentikasi ulang, dan alasan.
- [ ] Continuation memakai eksekusi sama dengan version baru, bukan eksekusi kedua.
- [ ] Checkpoint `verified_clean` dilewati kecuali memerlukan reverification.
- [ ] Retry otomatis dengan backoff tidak bertabrakan dengan continuation manual.
- [ ] Worker lama tidak dapat mengubah checkpoint setelah continuation.
- [ ] Retry identik tidak menggandakan attempt atau audit.
- [ ] Tidak ada transisi dari kegagalan parsial menuju reopening atau rollback data.
