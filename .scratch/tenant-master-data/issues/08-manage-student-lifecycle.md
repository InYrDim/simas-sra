# 08 — Kelola lifecycle dan archive Siswa

**What to build:** Tambahkan action khusus untuk perubahan status, koreksi kelulusan, archive, dan reactivation Profil Siswa tanpa menghapus history.

**Blocked by:** 07 — Kelola identitas Warga Sekolah dan Siswa.

**Status:** resolved

- [x] Siswa Aktif dapat berubah menjadi Lulus, Pindah, atau Keluar dengan effective date dan alasan/catatan yang diwajibkan.
- [x] Siswa Pindah atau Keluar dapat diterima kembali sebagai Aktif melalui history baru.
- [x] Lulus tidak dapat diubah melalui edit biasa; koreksi memakai action khusus dengan alasan dan before/after audit.
- [x] Effective date tidak boleh sebelum entry date dan periods tidak boleh tumpang tindih.
- [x] Scheduled future status change tidak tersedia.
- [x] Profil Siswa hanya dapat diarsipkan setelah Lulus, Pindah, atau Keluar.
- [x] Active relationship menolak archive dan UI menampilkan setiap blocker; active account hanya warning.
- [x] Archived profile read-only dan tidak dapat dipakai untuk relationship baru.
- [x] Reactivation mengulang uniqueness/relationship validation tanpa memulihkan status atau relationship lama.
- [x] Semua transition, denial, conflict, archive, dan reactivation memiliki command dan MySQL tests.

## Answer

Implemented append-preserving Profil Siswa lifecycle periods, dedicated status and graduation-correction commands, archive denial/audit with enumerated Tenant-scoped relationship blockers, active-account warnings, read-only archived profiles, and reactivation that revalidates current uniqueness/relationships without restoring lifecycle or relationship history. The shared Siswa workspace now exposes dedicated lifecycle, archive, correction, and reactivation actions while ordinary edits cannot change status.

TDD covered command, transport, shared UX, Tenant isolation, optimistic conflict, audit, and real-MySQL persistence behavior. Full tests (169), real-MySQL lifecycle tests, typecheck, lint, and diff review passed. The additive ticket migration was applied directly for MySQL validation because the repository-wide Drizzle migration runner remains blocked by unrelated historical `simas_application.owner_user_id` foreign-key migration drift.
