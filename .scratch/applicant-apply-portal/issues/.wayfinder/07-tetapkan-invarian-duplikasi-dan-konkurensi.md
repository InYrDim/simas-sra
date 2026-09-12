# Tetapkan invarian duplikasi dan konkurensi pengajuan

Type: grilling
Status: resolved
Blocked by: 01, 04

## Question

Constraint database dan aturan transaksi apa yang menolak pengajuan NPSN duplikat lintas akun, membatasi satu pengajuan pending, mengizinkan pengajuan ulang yang sah, dan tetap aman terhadap submit atau approval bersamaan?

## Answer

Ikatan permanen Pemohon–NPSN disimpan sebagai record database tersendiri, bukan disimpulkan dari riwayat Pengajuan SIMAS. Record tersebut memiliki constraint unik pada `userId` dan NPSN kanonis sehingga satu Pemohon hanya dapat mewakili satu sekolah dan satu NPSN hanya dapat dimiliki satu Pemohon. NPSN dinormalisasi dan divalidasi sebelum transaksi; input asli boleh tersimpan dalam snapshot, tetapi tidak menentukan identitas sekolah. Penolakan tidak menghapus ikatan. Konflik NPSN lintas akun tidak membuat Pengajuan atau memindahkan ikatan, tidak mengungkap identitas maupun status pemilik, dan diarahkan ke penanganan manual oleh Provider.

Pembuatan ikatan dan Pengajuan pertama terjadi dalam satu transaksi agar keduanya commit atau rollback bersama. Constraint unik menentukan pemenang jika akun yang sama secara bersamaan mengirim NPSN berbeda atau beberapa akun mengirim NPSN yang sama. Submit berikutnya lebih dahulu mengunci record ikatan, memvalidasi ulang bahwa Pengajuan final terbaru adalah `rejected`, lalu membuat record baru. Setiap Pengajuan memiliki `attemptNumber` monotonik per ikatan dengan constraint unik pada pasangan ikatan dan nomor tersebut; urutan riwayat tidak bergantung pada timestamp.

Database mengizinkan maksimal satu Pengajuan berstatus `pending` per ikatan melalui unique constraint/index kondisional. Record `rejected` dan `approved` tetap immutable dalam riwayat. Transisi status hanya boleh `pending → rejected` atau `pending → approved`, menggunakan update bersyarat yang hanya menang ketika status masih `pending`. Hasil final tidak dapat dibuka atau ditimpa: retry keputusan identik bersifat idempoten, sedangkan keputusan berbeda setelah final ditolak sebagai konflik.

Setiap submit membawa idempotency key yang unik per pemilik dan disimpan bersama Pengajuan. Retry dengan key serta payload yang sama mengembalikan Pengajuan yang sudah ada; key yang sama dengan payload berbeda ditolak sebagai konflik. Constraint satu `pending` tetap menjadi pertahanan terakhir terhadap key berbeda, double-click, dan request bersamaan.

Submit dan approval memakai urutan lock kanonis yang sama: ikatan Pemohon–NPSN lebih dahulu, kemudian Pengajuan, lalu identitas user dan record terkait. Setelah lock diperoleh, transaksi memvalidasi ulang seluruh state. Dengan demikian submit, resubmit, rejection, dan approval untuk sekolah yang sama terserialisasi; hanya operasi yang masih sah terhadap state terkini yang dapat commit.
