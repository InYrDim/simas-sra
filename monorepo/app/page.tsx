import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { ArrowRight, BookOpen, LayoutDashboard, ShieldCheck, Zap } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary p-1.5 rounded-lg">
              <BookOpen className="size-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight">SIMAS</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <Link href="#fitur" className="hover:text-foreground transition-colors">Fitur</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/login" className={buttonVariants({ variant: "ghost", className: "hidden sm:inline-flex" })}>
              Masuk
            </Link>
            <Link href="/login" className={buttonVariants({ className: "rounded-full shadow-lg shadow-primary/20" })}>
              Mulai Sekarang <ArrowRight className="ml-2 size-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-24 pb-32 md:pt-32 md:pb-40">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-background to-background -z-10" />
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3">
            <div className="w-96 h-96 bg-primary/30 rounded-full blur-3xl opacity-50 mix-blend-multiply" />
          </div>
          
          <div className="container mx-auto px-4 text-center max-w-4xl">
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm text-primary mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse"></span>
              Platform Manajemen Sekolah Generasi Baru
            </div>
            
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 text-balance animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
              Kelola Sekolah Anda dengan <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500">Lebih Cerdas</span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto text-balance animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
              SIMAS memberikan solusi terpadu untuk administrasi, akademik, dan komunikasi. Tingkatkan efisiensi dan bawa institusi Anda ke masa depan digital.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300">
              <Link href="/login" className={buttonVariants({ size: "lg", className: "w-full sm:w-auto text-base rounded-full h-14 px-8 shadow-xl shadow-primary/25 transition-transform hover:scale-105" })}>
                Masuk ke Dasbor <ArrowRight className="ml-2 size-5" />
              </Link>
              <Link href="#fitur" className={buttonVariants({ size: "lg", variant: "outline", className: "w-full sm:w-auto text-base rounded-full h-14 px-8" })}>
                Pelajari Lebih Lanjut
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="fitur" className="py-24 bg-muted/50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Fitur Unggulan</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Semua yang Anda butuhkan untuk menjalankan operasional sekolah dengan lancar dalam satu platform yang terintegrasi.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {[
                {
                  icon: LayoutDashboard,
                  title: "Dasbor Intuitif",
                  description: "Pantau seluruh aktivitas akademik dan administrasi dari satu layar yang mudah digunakan."
                },
                {
                  icon: Zap,
                  title: "Kinerja Cepat",
                  description: "Sistem yang dioptimalkan untuk akses cepat tanpa hambatan, kapanpun dan dimanapun."
                },
                {
                  icon: ShieldCheck,
                  title: "Keamanan Data Terjamin",
                  description: "Data siswa dan sekolah dilindungi dengan standar keamanan tinggi dan enkripsi."
                }
              ].map((feature, i) => (
                <div key={i} className="group relative p-8 rounded-3xl bg-background border border-border/50 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative z-10">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <feature.icon className="size-6" />
                    </div>
                    <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        
        {/* CTA Section */}
        <section className="py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-primary/5 -z-10" />
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Siap untuk Memulai?</h2>
            <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
              Bergabunglah dengan ratusan sekolah lainnya yang telah bertransformasi secara digital dengan SIMAS.
            </p>
            <Link href="/login" className={buttonVariants({ size: "lg", className: "rounded-full h-14 px-10 text-lg shadow-xl shadow-primary/20 transition-transform hover:scale-105" })}>
              Akses Platform Sekarang
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/40 py-12 bg-background">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <BookOpen className="size-5" />
            <span className="font-semibold text-foreground">SIMAS</span>
          </div>
          <p>© {new Date().getFullYear()} Sistem Informasi Manajemen Sekolah. Hak Cipta Dilindungi.</p>
          <div className="flex gap-4">
            <Link href="#" className="hover:text-foreground">Kebijakan Privasi</Link>
            <Link href="#" className="hover:text-foreground">Syarat & Ketentuan</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
