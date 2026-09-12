# 15 — Amankan login dan navigasi khusus Tenant

**What to build:** Pengguna dapat masuk melalui domain Tenant yang valid dan hanya mencapai portal atau Tenant yang ditentukan oleh identitas server. Domain requested mempertahankan konteks tetapi tidak memberi membership, continuation dibatasi ke Tenant yang sama, dan seluruh area membedakan anonymous dari authenticated-but-unauthorized.

**Blocked by:** 11 — Daftarkan Pemohon dan arahkan identitas pusat; 14 — Promosikan Pemohon melalui approval atomik.

**Status:** ready-for-agent

- [ ] Login Tenant menyelesaikan domain dengan exact server-side match sebelum menampilkan form.
- [ ] Domain yang tidak mempunyai Tenant menampilkan “Tenant tidak ditemukan” tanpa form, default Tenant, atau pencarian berdasarkan nama sekolah.
- [ ] Kredensial mengautentikasi user global dan relasi user–Tenant menentukan otorisasi; domain URL tidak pernah dianggap bukti membership.
- [ ] Member yang masuk melalui Tenant sendiri menuju continuation yang sah atau dashboard Tenant.
- [ ] Member yang masuk melalui Tenant lain tidak memperoleh akses dan diarahkan ke dashboard Tenant miliknya.
- [ ] Pemohon yang masuk dari login Tenant diarahkan ke `/apply`; Provider Admin diarahkan ke Provider; invalid identity diarahkan ke access error.
- [ ] Continuation hanya menerima relative path dengan prefix exact Tenant yang diminta dan tetap melewati authorization halaman setelah login.
- [ ] Absolute URL, protocol-relative URL, encoded bypass, prefix-boundary trick, cross-Tenant path, `/apply`, dan Provider path diabaikan dengan fallback aman.
- [ ] Anonymous pada area applicant, Provider, dan Tenant diarahkan ke entry point masing-masing.
- [ ] Authenticated-but-unauthorized diarahkan ke destination sah atau access error, bukan diperlakukan sebagai anonymous.
- [ ] Guard query, page, dan action mencegah akses lintas portal dan lintas Tenant meskipun URL atau payload dimanipulasi.
- [ ] Test service, route, dan browser mencakup domain valid/unknown, own/cross Tenant, seluruh identity path, continuation valid, dan corpus open redirect.
