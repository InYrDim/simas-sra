# 05 — Tenant Onboarding (Trial Provisioning)

**What to build:** Form registrasi untuk Tenant baru di halaman Provider. Form ini akan membuat data tenant (dengan trial 1 bulan), membuat akun admin pertama untuk tenant tersebut, lalu melakukan redirect agar mereka langsung masuk ke subdomain barunya.

**Blocked by:** 03 — Provider Dashboard, 04 — Auth & Tenant Association

**Status:** ready-for-agent

- [ ] Terdapat halaman form registrasi di rute provider.
- [ ] Submit form akan memicu transaksi database: insert `tenant` (set trial_ends_at = 1 bulan dari sekarang) dan insert `user`.
- [ ] Setelah berhasil, browser di-redirect ke subdomain milik tenant tersebut.
