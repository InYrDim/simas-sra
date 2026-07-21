import { GraduationCap } from "lucide-react"

// Dipakai baik saat belum ada Sesi PPDB yang "published", maupun saat Sesi ditutup di antara render halaman dan submit —
// URL publik ini dibagikan permanen sehingga harus tetap ramah, bukan halaman 404.
export function PpdbSessionClosedNotice() {
  return (
    <div className="min-h-svh bg-slate-100 flex justify-center pb-20">
      <main className="w-full max-w-md bg-white shadow-xl min-h-[100dvh] flex flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="rounded-full bg-slate-100 p-4">
          <GraduationCap className="size-8 text-slate-400" />
        </div>
        <h1 className="text-lg font-bold text-slate-900">Pendaftaran PPDB belum dibuka</h1>
        <p className="text-sm text-slate-500">
          Saat ini belum ada Sesi PPDB yang sedang berjalan untuk sekolah ini. Silakan cek kembali halaman ini nanti, atau hubungi pihak sekolah untuk informasi lebih lanjut.
        </p>
      </main>
    </div>
  )
}
