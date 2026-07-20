# 02 — Sediakan pola halaman Master Data yang konsisten

**What to build:** Buat pola workspace yang dapat dipakai halaman Master Data berikutnya. Pola ini harus menangani list, detail, form, URL state, responsive layout, loading, error, archive, dan accessibility tanpa berisi aturan domain khusus satu entity.

**Blocked by:** 01 — Lindungi seluruh area Master Data.

**Status:** resolved

- [x] Search, filter, sorting, page, page size, archive scope, dan selected record dapat disimpan di URL.
- [x] Pagination memakai server data dengan default 25 dan pilihan 25, 50, atau 100.
- [x] Desktop dapat menampilkan list dan detail berdampingan; tablet dapat memakai detail sheet; mobile memakai list ringkas dan detail layar penuh.
- [x] Tersedia contoh/pola yang dapat dipakai ulang untuk first-use empty, filtered no-results, loading, region error, read-only, archived, dan concurrent conflict.
- [x] Detail bersifat read-only secara default; create/edit dan lifecycle action tidak dilakukan sebagai inline table edit.
- [x] Form pattern mempertahankan input yang salah, menampilkan error summary, memindahkan fokus ke field pertama yang salah, dan memperingatkan unsaved changes.
- [x] Archive state dibedakan dari domain lifecycle state di label dan filter.
- [x] Icon-only button memiliki accessible name; status tidak disampaikan dengan warna saja; keyboard focus terlihat.
- [x] Automated accessibility check dan manual keyboard smoke test untuk pola contoh lulus.

## Answer

Implemented a reusable Master Data URL query model, responsive list/detail workspace, server pagination controls, distinct shared state components, and an accessible form shell with preserved input, linked error summary, first-invalid-field focus, and unsaved-navigation warnings. The Siswa placeholder is now a clearly labelled, non-persisted representative workspace for later entity tickets. Added route loading/error boundaries and an automated axe check; source-level keyboard smoke verified logical focus order, visible focus styles, named controls, textual statuses, and mobile detail return navigation.
