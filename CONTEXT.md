# SIMAS

SIMAS adalah aplikasi SaaS pendidikan yang dikelola secara terpusat oleh penyedia layanan dan menyediakan ruang kerja terisolasi bagi setiap sekolah.

## Language

**Provider**:
Organisasi internal yang memiliki dan mengoperasikan layanan SIMAS untuk seluruh sekolah.
_Avoid_: Tenant, sekolah, developer

**Provider Admin**:
Pengguna internal Provider yang mengelola layanan SIMAS dan seluruh Tenant. Untuk saat ini, ini adalah satu-satunya role di sisi Provider.
_Avoid_: Superadmin, School Admin, developer

**School Admin**:
Pengguna dengan kewenangan administratif tertinggi di dalam satu Tenant dan hanya mengelola sekolahnya sendiri.
_Avoid_: Superadmin, Provider Admin, admin Provider

**Tenant**:
Ruang kerja sekolah yang terisolasi di dalam SIMAS, mencakup data, konfigurasi, dan pengguna milik satu sekolah.
_Avoid_: Provider, customer, akun

**Penyediaan Tenant**:
Pembentukan ruang kerja sekolah oleh Provider sebelum sekolah mulai menggunakan SIMAS.
_Avoid_: Onboarding Provider, onboarding Tenant

**Onboarding Tenant**:
Proses yang dilakukan sekolah untuk menginisialisasi SIMAS bagi sekolahnya setelah ruang kerja tersedia.
_Avoid_: Penyediaan Tenant, pendaftaran oleh Provider

**Pengajuan SIMAS**:
Permohonan sekolah kepada Provider untuk memperoleh Tenant SIMAS. Pengajuan yang ditolak tidak diubah atau dibuka kembali; sekolah mengirim Pengajuan SIMAS baru.
_Avoid_: Tenant, registrasi pengguna, Onboarding Tenant

**Kredensial sementara**:
Rahasia sekali pakai yang diterbitkan Provider untuk login awal School Admin dan wajib diganti sebelum School Admin dapat menggunakan Tenant.
_Avoid_: kata sandi permanen, undangan Provider

**Trial Tenant**:
Masa evaluasi penggunaan SIMAS yang dimulai ketika sekolah menyelesaikan Onboarding Tenant, bukan ketika Tenant disediakan atau School Admin login pertama kali.
_Avoid_: masa onboarding, masa sejak persetujuan
