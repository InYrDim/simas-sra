# 05 — Tegakkan akses Tenant yang ditutup secara terpusat

**What to build:** Terapkan capability resolver deny-by-default agar Tenant `closed` berhenti beroperasi pada seluruh channel yang tersedia. School Admin masih dapat membuka Halaman Status Tenant, sedangkan non-admin hanya menerima pesan netral.

**Blocked by:** 02 — Ajukan dan putuskan Penutupan Tenant.

**Status:** ready-for-agent

- [ ] Resolver membaca status Tenant terkini pada setiap keputusan dan fail-closed ketika state tidak dapat dibaca.
- [ ] Tenant aktif mempertahankan seluruh perilaku akses existing.
- [ ] School Admin Tenant tertutup hanya dapat memakai Halaman Status Tenant dan aksi lifecycle yang diizinkan.
- [ ] Non-admin menerima pesan netral tanpa alasan, deadline, blocker, atau history.
- [ ] Dashboard dan protected action existing ditolak untuk Tenant tertutup.
- [ ] Provider Admin, support, dan lifecycle worker hanya mendapat capability eksplisit.
- [ ] API key, service account, public surface, webhook, job, dan channel baru default-nya ditolak.
- [ ] Job menyediakan gate status/fence sebelum side effect penting.
- [ ] Invalidation wajib selesai sebelum status closed/reopened dianggap terlihat pada permukaan cache/public.
- [ ] Test access matrix membuktikan sesi aktif dan channel non-browser tidak dapat menjadi bypass.
