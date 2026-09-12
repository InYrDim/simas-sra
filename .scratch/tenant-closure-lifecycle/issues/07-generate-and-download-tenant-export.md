# 07 — Hasilkan dan unduh Paket Ekspor Tenant

**What to build:** School Admin dapat meminta, memantau, dan mengunduh Paket Ekspor Tenant terverifikasi tanpa approval discretionary. Provider dapat meminta untuk support, retry, repair, cancel, atau mengalihkan requester secara terkontrol.

**Blocked by:** 04 — Kelola Masa Tunggu Penghapusan dan kesiapan akhir; 05 — Tegakkan akses Tenant yang ditutup secara terpusat.

**Status:** ready-for-agent

- [ ] Request ekspor memerlukan autentikasi ulang dan hanya diterima sebelum deletion dimulai.
- [ ] Hanya satu ekspor aktif per Kasus Penutupan Tenant.
- [ ] Scope disnapshot saat request dan tidak berubah mengikuti data sumber.
- [ ] Paket versioned berisi CSV UTF-8, JSON, file relevan, manifest, checksum, dan README Bahasa Indonesia.
- [ ] Secret, session, token, data Provider, diagnostics keamanan, dan data Tenant lain dikecualikan.
- [ ] Paket hanya `available` setelah completeness dan checksum terverifikasi; paket parsial tidak dapat diunduh.
- [ ] Link terikat requester, single-use, berlaku 15 menit, dan download memerlukan autentikasi ulang.
- [ ] Artifact tersedia tujuh hari dan dapat diganti selama deletion belum dimulai.
- [ ] Kegagalan sementara dicoba ulang maksimal tiga kali.
- [ ] Export aktif atau gagal-belum-diselesaikan memblokir deletion; outcome final nonaktif tidak memblokir.
- [ ] Provider support request memerlukan alasan; reassignment hanya kepada School Admin aktif dan diaudit.
- [ ] Reopening dan deletion confirmation membersihkan artifact secara aman.
