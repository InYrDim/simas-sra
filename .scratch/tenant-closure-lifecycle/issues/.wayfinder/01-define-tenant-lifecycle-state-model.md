# Tetapkan model status lifecycle Tenant

Type: grilling
Status: resolved

## Question

Status, transisi, invariant, dan terminologi apa yang harus menjadi model canonical untuk lifecycle Tenant sejak aktif, pengajuan penutupan, peninjauan, ditutup, menunggu penghapusan, permintaan pembukaan kembali, siap dihapus, hingga dihapus; termasuk bagaimana permintaan yang ditolak, dibatalkan, kedaluwarsa, atau bersamaan direpresentasikan tanpa mencampur status Tenant dengan status workflow?

## Answer

Gunakan dua state machine terpisah agar status operasional Tenant tidak tercampur dengan workflow:

### Status operasional Tenant

- `active`: Tenant beroperasi normal. Pengajuan penutupan yang masih ditinjau tidak mengubah status ini.
- `closed`: Tenant berhenti beroperasi tetapi data masih dipertahankan dan Tenant dapat dibuka kembali.

`deleted` bukan status pada row Tenant. Setelah penghapusan berhasil, row Tenant dan data operasional sekolah dihapus, sedangkan hasilnya direkam pada Kasus Penutupan Tenant dan Catatan Penghapusan Tenant yang tidak menyimpan data operasional sekolah.

### Status Kasus Penutupan Tenant

Status berjalan:

- `pending_closure_review`: pengajuan School Admin menunggu keputusan Provider.
- `closed_waiting_deletion`: Tenant sudah ditutup dan masa tunggu berjalan.
- `pending_reopening_review`: permintaan pembukaan kembali menunggu keputusan Provider.
- `ready_for_deletion`: tenggat tercapai dan kasus menunggu konfirmasi akhir Provider.
- `deletion_in_progress`: penghapusan sedang dieksekusi dan tidak boleh dimulai dua kali.
- `deletion_failed`: eksekusi gagal dan hanya dapat dicoba ulang Provider setelah penyebabnya ditangani.

Status final dan immutable:

- `rejected`: Provider menolak pengajuan penutupan.
- `cancelled`: School Admin membatalkan sebelum Tenant ditutup.
- `expired`: pengajuan tidak diputuskan dalam 14 hari.
- `reopened`: Provider menyetujui pembukaan kembali dan Tenant aktif lagi.
- `deleted`: penghapusan berhasil dan Catatan Penghapusan Tenant diterbitkan.

### Transisi

- Alur School Admin dimulai pada `pending_closure_review`.
- Persetujuan Provider menutup Tenant dan memindahkan kasus ke `closed_waiting_deletion`; penolakan, pembatalan, atau 14 hari tanpa keputusan menyelesaikan kasus sebagai `rejected`, `cancelled`, atau `expired` tanpa menutup Tenant.
- Alur yang dimulai Provider langsung menutup Tenant dan masuk `closed_waiting_deletion`.
- Tenggat secara otomatis mengubah `closed_waiting_deletion` menjadi `ready_for_deletion`, tetapi tidak otomatis menghapus Tenant.
- Permintaan pembukaan kembali mengubah kasus menjadi `pending_reopening_review` dan memblokir penghapusan tanpa menghentikan atau menggeser tenggat.
- Persetujuan pembukaan kembali mengaktifkan Tenant dan menyelesaikan kasus sebagai `reopened`. Penolakan mengembalikan kasus ke `closed_waiting_deletion` bila tenggat belum lewat, atau `ready_for_deletion` bila sudah lewat.
- Konfirmasi akhir Provider mengubah `ready_for_deletion` menjadi `deletion_in_progress`. Keberhasilan menghasilkan `deleted`; kegagalan menghasilkan `deletion_failed`; retry kembali ke `deletion_in_progress`.
- Ekspor yang belum selesai memblokir penghapusan. Setelah blocker pembukaan kembali atau ekspor selesai, status dihitung ulang berdasarkan tenggat yang tidak berubah.

### Invariant

- Hanya satu Kasus Penutupan Tenant yang berjalan untuk satu Tenant.
- Pengajuan berulang bersifat idempotent dan tidak membuat kasus duplikat.
- Semua aktor bertindak pada kasus berjalan yang sama; Provider tidak membuat kasus kedua untuk mengambil alih pengajuan School Admin.
- Kasus baru hanya dapat dibuat setelah kasus sebelumnya final sebagai `rejected`, `cancelled`, atau `reopened`. Setelah `deleted`, Tenant tidak lagi tersedia.
- Status final tidak dapat dibuka atau diubah kembali.
