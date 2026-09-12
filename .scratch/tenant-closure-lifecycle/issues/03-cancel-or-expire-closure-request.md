# 03 — Batalkan atau kedaluwarsakan pengajuan Penutupan Tenant

**What to build:** School Admin dapat membatalkan pengajuan yang belum diputuskan, termasuk pengajuan administrator lain, sedangkan scheduler mengakhiri pengajuan yang tidak diputuskan selama 14 hari. Tenant tetap aktif dan kasus baru dapat diajukan setelah outcome final.

**Blocked by:** 02 — Ajukan dan putuskan Penutupan Tenant.

**Status:** ready-for-agent

- [ ] Setiap School Admin aktif pada Tenant yang sama dapat membatalkan kasus `pending_closure_review`.
- [ ] Pembatalan pengajuan milik admin lain mewajibkan alasan dan dicatat dalam audit.
- [ ] Pembatalan tidak dapat memenangkan race setelah Provider memutuskan kasus.
- [ ] Tepat pada 14 hari kasus dapat menjadi `expired`; sebelum batas tersebut tidak boleh.
- [ ] Cancellation dan expiry tidak menutup Tenant atau membuat jadwal penghapusan.
- [ ] Retry expiry tidak menggandakan audit atau outbox.
- [ ] Kasus `cancelled`, `expired`, dan `rejected` immutable tetapi mengizinkan kasus baru.
- [ ] Race cancel-versus-approve dan expire-versus-approve menghasilkan satu outcome legal.
- [ ] UI menampilkan actor/waktu pengajuan serta outcome yang boleh dilihat School Admin.
