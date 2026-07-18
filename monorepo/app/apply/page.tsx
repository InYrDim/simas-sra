import Link from "next/link";
import { BookOpen } from "lucide-react";

import { ApplicationForm } from "@/app/apply/application-form";

export default function ApplyPage() {
  return (
    <main className="min-h-screen bg-muted/30 px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 font-semibold">
          <BookOpen className="size-5 text-primary" />
          SIMAS
        </Link>
        <div className="rounded-xl border bg-background p-6 shadow-sm sm:p-10">
          <header className="mb-10">
            <p className="text-sm font-medium text-primary">Pengajuan SIMAS</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Daftarkan sekolah Anda</h1>
            <p className="mt-3 text-muted-foreground">
              Lengkapi identitas sekolah dan kontak penanggung jawab. Tim Provider akan meninjau pengajuan sebelum Tenant sekolah disediakan.
            </p>
          </header>
          <ApplicationForm />
        </div>
      </div>
    </main>
  );
}
