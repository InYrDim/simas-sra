# 04 — Kelola Masa Tunggu Penghapusan dan kesiapan akhir

**What to build:** Provider Admin dapat mengatur override per Tenant dan mengubah deadline kasus berjalan. Scheduler membuat kasus siap dihapus tanpa menghapus otomatis, sementara School Admin melihat timestamp absolut authoritative dan countdown sekunder.

**Blocked by:** 02 — Ajukan dan putuskan Penutupan Tenant.

**Status:** ready-for-agent

- [ ] Provider Admin dapat menyimpan override 1–365 hari untuk kasus berikutnya.
- [ ] Perubahan override tidak mengubah snapshot kasus berjalan.
- [ ] Provider dapat memperpanjang atau memperpendek deadline dengan alasan; pemendekan memerlukan autentikasi ulang.
- [ ] Deadline dapat dipindahkan ke waktu sekarang tetapi tidak ke masa lalu.
- [ ] Perubahan ditolak setelah Eksekusi Penghapusan Tenant dimulai.
- [ ] Tepat pada deadline, kasus menjadi `ready_for_deletion`; scheduler terlambat tidak menggeser deadline.
- [ ] Readiness tidak pernah memulai Penghapusan Tenant otomatis.
- [ ] Transition readiness, audit, dan outbox idempotent.
- [ ] UI menampilkan timestamp absolut dan zona waktu sebagai sumber kebenaran.
- [ ] Test mencakup sebelum, tepat pada, dan sesudah deadline serta zona waktu dengan daylight-saving.
