# Tentukan state machine portal apply

Type: prototype
Status: resolved
Blocked by: 01

## Question

State, transisi, dan tindakan apa yang harus ditampilkan `/apply` untuk pengunjung anonim, Pemohon tanpa pengajuan, pengajuan pending, pengajuan rejected, dan School Admin dari pengajuan approved—termasuk riwayat dan pengajuan ulang?

## Answer

State portal `/apply` diturunkan server-side dari identitas user dan Pengajuan SIMAS terakhir. Portal memiliki lima state:

1. **Anonim** menampilkan pengantar portal serta tindakan untuk mendaftar sebagai Pemohon atau masuk. Registrasi berhasil membawa user ke state Pemohon tanpa Pengajuan; login membawa user ke state yang sesuai dengan identitas dan riwayatnya.
2. **Pemohon tanpa Pengajuan** menampilkan identitas akun, empty state riwayat, dan tindakan untuk membuat Pengajuan SIMAS pertama.
3. **Pengajuan pending** menampilkan status peninjauan, detail snapshot yang dikirim, dan seluruh riwayat Pengajuan. Pemohon hanya dapat melihat detail; Pengajuan pending tidak dapat diedit atau dibatalkan. Hanya Provider yang dapat memindahkannya ke rejected atau menyetujuinya.
4. **Pengajuan rejected** menampilkan alasan penolakan yang wajib diisi Provider, detail snapshot immutable, seluruh riwayat, dan tindakan untuk membuat Pengajuan baru. Pemohon dapat langsung mengajukan ulang tanpa masa tunggu atau batas percobaan. Pengajuan ulang selalu membuat record baru untuk NPSN yang sama dan tidak membuka atau mengubah Pengajuan lama.
5. **School Admin** adalah state langsung setelah approval atomik; tidak ada state portal `approved` yang terpisah. `/apply` tetap menampilkan ringkasan approval, riwayat seluruh Pengajuan, dan tindakan untuk masuk ke Tenant, sehingga portal juga menjadi titik pemulihan domain Tenant. School Admin tidak dapat membuat Pengajuan lagi.

Transisi bisnisnya adalah:

- Anonim → Pemohon tanpa Pengajuan melalui registrasi publik.
- Pemohon tanpa Pengajuan → Pengajuan pending ketika Pengajuan pertama berhasil dikirim.
- Pengajuan pending → Pengajuan rejected ketika Provider menolak dengan alasan wajib.
- Pengajuan rejected → Pengajuan pending ketika Pengajuan baru berhasil dikirim.
- Pengajuan pending → School Admin ketika approval, promosi user, dan penyediaan Tenant berhasil secara atomik.

Isian form yang belum dikirim bukan Pengajuan SIMAS, bukan state domain, dan tidak disimpan sebagai draft; refresh atau keluar boleh menghilangkan isian. Rate limiting atau kontrol penyalahgunaan pengajuan ulang, jika diperlukan, merupakan kontrol teknis terpisah dan tidak menambah state bisnis portal.
