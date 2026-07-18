Type: prototype
Status: resolved

## Question

Bagaimana bentuk konkret sidebar Provider dan sidebar Tenant bertema deep navy pada desktop, collapsed mode, serta mobile agar hierarki, identitas, active state, empty state, dan aksesibilitasnya siap dispesifikasikan?

## Answer

Pilih **A — Grouped navigation** sebagai dasar spesifikasi karena paling mudah dipahami dan tidak menambahkan banyak abstraksi. Struktur yang dipertahankan:

- Sidebar Provider netral dengan menu dikelompokkan menjadi area utama dan operasional.
- Sidebar Tenant menggunakan tema deep navy tanpa mengubah struktur navigasinya.
- Identitas konteks dan pengguna tetap terlihat pada expanded mode.
- Collapsed mode mempertahankan ikon, tooltip nama menu, dan active state.
- Mobile menggunakan drawer dengan trigger berlabel dan status buka/tutup yang dapat dibaca teknologi asistif.
- Empty state menjelaskan konten yang kelak muncul, bukan sekadar ruang kosong.

Arah **B — Operational rail** dan **C — Context bands** ditolak karena menambah lapisan abstraksi yang tidak diperlukan untuk navigasi SIMAS.

Prototype: [`/provider-sidebar-prototype?variant=A`](../../../monorepo/app/provider-sidebar-prototype/page.tsx)
