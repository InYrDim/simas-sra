# 11 — Daftarkan Pemohon dan arahkan identitas pusat

**What to build:** Pengunjung dapat mendaftar sebagai Pemohon dan masuk melalui perjalanan pusat, lalu sistem mengarahkan setiap user berdasarkan satu identity path yang dihitung server. Pemohon baru tiba pada empty state `/apply`, sedangkan identity yang invalid berhenti pada halaman access error yang aman.

**Blocked by:** 09 — Siapkan migrasi aman untuk identitas Pemohon.

**Status:** done

- [x] Registrasi publik membuat user, credential account, dan Pemohon secara atomik tanpa menerima role atau Tenant dari client.
- [x] Pemohon baru belum terikat ke NPSN sampai Pengajuan pertama berhasil dikirim.
- [x] `/apply` anonim menampilkan pengantar serta link login dan registrasi dengan intent apply.
- [x] Hanya enum intent `apply` yang dikenali; URL bebas, nilai unknown, encoded bypass, dan callback-like input diabaikan serta dicatat dalam structured security log.
- [x] Resolver identitas menghasilkan tepat satu hasil Provider Admin, Pemohon, Tenant member, atau invalid berdasarkan relasi server.
- [x] Resolver tujuan mengarahkan Provider Admin ke Provider, Pemohon ke `/apply`, Tenant member ke dashboard Tenant, activation wajib ke pergantian password, dan invalid identity ke access error.
- [x] User bersesi yang membuka login atau registrasi langsung diarahkan menurut identitas dan harus logout untuk mengganti akun.
- [x] Pemohon tanpa Pengajuan melihat identitas akun, empty history, dan tindakan membuat Pengajuan pertama.
- [x] Access error hanya menampilkan penjelasan aman, kontak Provider, dan logout; detail invariant hanya masuk log server.
- [x] Test service dan route mencakup setiap identity path, nol path, multi-path, Tenant hilang, serta identity yang selalu mengalahkan intent.
