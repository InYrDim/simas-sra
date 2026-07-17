import Link from "next/link";
import { BookOpen, Sparkles } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      {/* Kolom Kiri: Visual / Branding */}
      <div className="relative hidden lg:flex flex-col bg-slate-900 justify-between p-12 text-white overflow-hidden">
        {/* Background Pattern / Effect */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-blue-600/30 via-slate-900 to-indigo-900/50 z-0" />
        <div className="absolute -left-20 -bottom-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl opacity-50" />
        <div className="absolute top-20 right-10 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl opacity-60" />

        <div className="relative z-10 flex items-center gap-2">
          <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md border border-white/10">
            <BookOpen className="size-6 text-white" />
          </div>
          <span className="font-bold tracking-tight text-2xl">SIMAS</span>
        </div>

        <div className="relative z-10 max-w-lg mb-10 animate-in fade-in slide-in-from-left-8 duration-700">
          <div className="flex items-center gap-2 bg-white/10 w-fit px-4 py-1.5 rounded-full backdrop-blur-sm border border-white/10 mb-6">
            <Sparkles className="size-4 text-blue-300" />
            <span className="text-sm font-medium text-blue-100">Portal Pendidikan Masa Depan</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold mb-6 leading-tight text-transparent bg-clip-text bg-gradient-to-br from-white to-white/70">
            Digitalisasi Sekolah<br />Tanpa Batasan.
          </h1>
          <p className="text-white/70 text-lg leading-relaxed">
            Platform manajemen pendidikan terintegrasi untuk pimpinan, guru, dan staf administrasi. Kelola akademik, operasional, dan komunikasi dalam satu ruang digital.
          </p>
        </div>
      </div>

      {/* Kolom Kanan: Auth Form */}
      <div className="flex flex-col relative bg-background">
        {/* Mobile Header (Hanya muncul di HP) */}
        <div className="lg:hidden p-6 absolute top-0 left-0 w-full flex items-center justify-start border-b border-border/40 bg-background/80 backdrop-blur-md z-10">
          <Link href="/" className="flex items-center gap-2">
            <div className="bg-primary p-1.5 rounded-lg">
              <BookOpen className="size-5 text-primary-foreground" />
            </div>
            <span className="font-bold tracking-tight text-lg">SIMAS</span>
          </Link>
        </div>

        <main className="flex-1 flex flex-col justify-center items-center p-6 lg:p-12 mt-16 lg:mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="w-full max-w-[400px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
