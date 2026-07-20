# 02 — Sediakan pola halaman Master Data yang konsisten

**What to build:** Buat pola workspace yang dapat dipakai halaman Master Data berikutnya. Pola ini harus menangani list, detail, form, URL state, responsive layout, loading, error, archive, dan accessibility tanpa berisi aturan domain khusus satu entity.

**Blocked by:** 01 — Lindungi seluruh area Master Data.

**Status:** ready-for-agent

- [ ] Search, filter, sorting, page, page size, archive scope, dan selected record dapat disimpan di URL.
- [ ] Pagination memakai server data dengan default 25 dan pilihan 25, 50, atau 100.
- [ ] Desktop dapat menampilkan list dan detail berdampingan; tablet dapat memakai detail sheet; mobile memakai list ringkas dan detail layar penuh.
- [ ] Tersedia contoh/pola yang dapat dipakai ulang untuk first-use empty, filtered no-results, loading, region error, read-only, archived, dan concurrent conflict.
- [ ] Detail bersifat read-only secara default; create/edit dan lifecycle action tidak dilakukan sebagai inline table edit.
- [ ] Form pattern mempertahankan input yang salah, menampilkan error summary, memindahkan fokus ke field pertama yang salah, dan memperingatkan unsaved changes.
- [ ] Archive state dibedakan dari domain lifecycle state di label dan filter.
- [ ] Icon-only button memiliki accessible name; status tidak disampaikan dengan warna saja; keyboard focus terlihat.
- [ ] Automated accessibility check dan manual keyboard smoke test untuk pola contoh lulus.
