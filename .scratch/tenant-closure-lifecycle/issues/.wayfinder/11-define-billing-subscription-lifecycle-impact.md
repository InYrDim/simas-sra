# Tetapkan dampak lifecycle terhadap billing dan subscription

Type: grilling
Status: resolved
Blocked by: 01, 05

## Question

Bagaimana pengajuan, Penutupan Tenant, masa tunggu, Pembukaan Kembali, kesiapan penghapusan, dan Penghapusan Tenant memengaruhi status subscription, penagihan berjalan, kewajiban pembayaran, proration atau refund, serta hak Provider untuk menutup atau menahan penghapusan karena kondisi billing?

## Answer

Pengajuan Penutupan Tenant tidak mengubah subscription atau penagihan. Subscription tetap aktif dan biaya tetap berjalan selama pengajuan ditinjau. Batas berhentinya biaya baru adalah waktu efektif Tenant benar-benar ditutup, baik setelah persetujuan pengajuan School Admin maupun ketika Provider Admin memulai Penutupan Tenant secara langsung.

Ketika Tenant ditutup:

- subscription menjadi tidak aktif dan tidak menghasilkan biaya baru selama Masa Tunggu Penghapusan;
- tidak ada biaya retroaktif untuk waktu ketika Tenant ditutup;
- invoice dan kewajiban pembayaran yang sudah timbul tetap berlaku dan dapat ditagih;
- biaya periode berjalan dihitung prorata sejak waktu efektif penutupan;
- sisa pembayaran menjadi kredit billing milik sekolah, bukan refund tunai otomatis; dan
- refund hanya dilakukan melalui keputusan manual Provider, termasuk ketika kontrak atau hukum mensyaratkannya.

Provider boleh memulai Penutupan Tenant karena tunggakan sesuai kebijakan pembayaran yang berlaku. School Admin tetap boleh mengajukan Penutupan Tenant ketika terdapat tunggakan. Penutupan tidak menghapus utang, tetapi tunggakan tidak menghalangi Tenant memasuki Masa Tunggu Penghapusan, menjadi siap dihapus, atau menerima konfirmasi akhir Penghapusan Tenant. Provider tidak boleh menahan data operasional sekolah sebagai jaminan utang. Legal hold atau sengketa dengan dasar hukum hanya boleh memblokir penghapusan data terkait sejauh diwajibkan hukum.

Persetujuan Pembukaan Kembali Tenant membatalkan jadwal penghapusan, tetapi tidak langsung memulihkan akses operasional. Tenant kembali aktif setelah subscription baru berhasil diaktifkan. Kredit billing diterapkan terlebih dahulu; harga, paket, dan periode mengikuti ketentuan yang berlaku saat aktivasi baru, bukan meneruskan periode lama secara retroaktif. Tunggakan lama tetap tercatat dan hanya menghalangi aktivasi bila kebijakan kredit Provider mensyaratkannya. Jika aktivasi atau pembayaran awal gagal, Tenant tetap ditutup, tetapi jadwal penghapusan yang telah dibatalkan tidak hidup kembali otomatis.

Penghapusan Tenant hanya dikonfirmasi setelah subscription tidak aktif dan tidak ada proses pembentukan tagihan Tenant yang masih berjalan. Setelah konfirmasi, tidak boleh terbit invoice subscription baru atas Tenant tersebut. Invoice, pembayaran, tunggakan, kredit billing, refund, catatan pajak, dan catatan keuangan lain yang wajib dipertahankan disimpan terpisah dari Tenant menurut retensi hukum dan keuangan yang berlaku. Tunggakan, kredit yang belum digunakan, dan refund yang sedang diproses tidak memblokir Penghapusan Tenant; kredit tetap menjadi hak finansial sekolah dan dapat digunakan untuk layanan SIMAS lain yang sah atau diselesaikan melalui refund manual.
