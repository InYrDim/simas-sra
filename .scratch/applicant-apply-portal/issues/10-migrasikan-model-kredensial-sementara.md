# 10 — Migrasikan model Kredensial sementara

**What to build:** Provider-created School Admin tetap dapat memakai Kredensial sementara untuk login pertama, wajib mengganti password, dan menerima reset hanya sebelum autentikasi pertama, sementara model dan UI menyatakan dengan tepat bahwa activation ini tidak berlaku untuk semua School Admin.

**Blocked by:** 09 — Siapkan migrasi aman untuk identitas Pemohon.

**Status:** resolved

- [x] Model aktivasi School Admin diperluas lalu dimigrasikan menjadi model Kredensial sementara tanpa membuat flow existing berhenti di tengah rollout.
- [x] Seluruh record lama berpindah satu-banding-satu dengan user, Tenant, waktu penerbitan, waktu autentikasi pertama, kewajiban ganti password, dan waktu penggantian password tetap identik.
- [x] Migrasi tidak membuat record baru bagi School Admin yang sebelumnya tidak mempunyai activation.
- [x] Hanya user dengan activation dan kewajiban ganti password aktif yang diarahkan ke halaman pergantian password.
- [x] Reset Kredensial sementara tersedia hanya untuk akun buatan Provider yang belum berhasil melakukan autentikasi pertama.
- [x] Akun yang sudah login pertama kali menggunakan pemulihan password biasa dan tidak dapat menerima reset Kredensial sementara.
- [x] UI Provider menampilkan istilah Kredensial sementara dan status “Menunggu login pertama” hanya ketika activation memang ada.
- [x] Record activation tetap disimpan sebagai riwayat non-rahasia setelah password diganti dan tidak menyimpan nilai rahasia.
- [x] Test membuktikan flow Provider-created School Admin tidak berubah secara perilaku selama rename dan contract.

## Comments

Renamed the activation domain and table to temporary-credential activation, preserving rows in place and exposing an updatable legacy view for rolling deployments. Tenant access, onboarding, Provider listing/detail, password-change routing, and reset behavior now treat activation as optional while retaining the Provider-created first-login flow. Validation includes migration contract tests, the full automated suite, typecheck, lint, and production build.
