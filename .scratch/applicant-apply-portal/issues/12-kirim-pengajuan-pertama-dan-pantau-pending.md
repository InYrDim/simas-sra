# 12 — Kirim Pengajuan pertama dan pantau status pending

**What to build:** Pemohon tanpa Pengajuan dapat mengirim snapshot sekolah dan kontak, memperoleh ikatan permanen ke NPSN serta Pengajuan attempt pertama secara atomik, lalu memantau snapshot pending yang read-only melalui `/apply` tanpa risiko duplikasi dari retry atau request bersamaan.

**Blocked by:** 11 — Daftarkan Pemohon dan arahkan identitas pusat.

**Status:** ready-for-agent

- [ ] Action submit mewajibkan session Pemohon dan mengabaikan atau menolak owner, binding, attempt, role, serta status yang disuplai client.
- [ ] NPSN dinormalisasi dan divalidasi sebelum transaksi; canonical NPSN menentukan identitas sekolah sementara snapshot tetap menyimpan data presentasi Pengajuan.
- [ ] Submit pertama membuat ikatan user–NPSN dan Pengajuan attempt `1` dalam satu transaksi atau me-rollback keduanya.
- [ ] Satu user hanya dapat mempunyai satu binding dan satu canonical NPSN hanya dapat dimiliki satu user.
- [ ] Konflik NPSN lintas akun tidak membuat data, tidak memindahkan binding, tidak membocorkan identitas/status pemilik, dan mengarahkan Pemohon ke dukungan Provider.
- [ ] Idempotency key yang sama dengan payload sama mengembalikan Pengajuan existing; key sama dengan payload berbeda menghasilkan conflict.
- [ ] Database menolak lebih dari satu pending per binding, termasuk double-click dan request bersamaan dengan key berbeda.
- [ ] Setelah sukses, `/apply` menampilkan identifier, status pending, snapshot immutable, dan history berurut attempt; Pengajuan tidak dapat diedit atau dibatalkan.
- [ ] Test MySQL nyata membuktikan unique binding, unique idempotency, unique attempt, generated pending uniqueness, rollback, dan pemenang tunggal pada submit bersamaan.
- [ ] Authorization diuji pada query dan action server, bukan hanya dari visibilitas form.
