"use client"

import { useState, use } from "react"
import { ChevronRight, UploadCloud } from "lucide-react"

export default function PPDBStudentPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = use(params)
  const [step, setStep] = useState(1)
  const totalSteps = 3
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = () => {
    setIsSubmitting(true)
    // TODO: Call server action to submit form
    setTimeout(() => {
      alert("Pendaftaran berhasil dikirim!")
      setIsSubmitting(false)
      window.location.reload()
    }, 1500)
  }

  return (
    <div className="min-h-svh bg-slate-100 flex justify-center pb-20">
      <main className="w-full max-w-md bg-white shadow-xl min-h-[100dvh] relative overflow-hidden flex flex-col">
        <header className="px-5 py-4 border-b border-slate-100">
          <h1 className="font-bold text-slate-900">Pendaftaran PPDB</h1>
          <p className="text-xs text-slate-500">Domain: {domain}</p>
          
          <div className="mt-4">
            <div className="flex justify-between text-xs font-semibold text-slate-400 mb-1">
              <span>Langkah {step} dari {totalSteps}</span>
              <span>{Math.round((step / totalSteps) * 100)}%</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-sky-500 transition-all duration-300" 
                style={{ width: `${(step / totalSteps) * 100}%` }}
              />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5 pb-24">
          {step === 1 && (
            <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-300">
              <h2 className="text-lg font-bold mb-4">Informasi Pribadi</h2>
              <div>
                <label className="text-sm font-medium text-slate-700">Nama Lengkap</label>
                <input type="text" className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none" placeholder="Sesuai ijazah" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">NISN</label>
                <input type="number" className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none" placeholder="10 digit angka" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Tempat, Tanggal Lahir</label>
                <input type="text" className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none" placeholder="Contoh: Jakarta, 12 Agustus 2008" />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-300">
              <h2 className="text-lg font-bold mb-4">Alamat & Kontak</h2>
              <div>
                <label className="text-sm font-medium text-slate-700">Alamat Rumah</label>
                <textarea className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none" rows={3} placeholder="Alamat lengkap sesuai KK" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">No. WhatsApp</label>
                <input type="tel" className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none" placeholder="08..." />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-300">
              <h2 className="text-lg font-bold mb-4">Upload Dokumen</h2>
              
              <div className="rounded-xl border-2 border-dashed border-slate-200 hover:border-sky-300 transition-colors p-6 text-center cursor-pointer">
                <UploadCloud className="size-8 text-sky-500 mx-auto mb-2" />
                <p className="text-sm font-medium">Scan Kartu Keluarga (KK)</p>
                <p className="text-xs text-slate-500 mt-1">Format PDF/JPG max 2MB</p>
                <button className="mt-3 bg-sky-50 text-sky-600 px-4 py-1.5 rounded-full text-xs font-semibold">Pilih File</button>
              </div>

              <div className="rounded-xl border-2 border-dashed border-slate-200 hover:border-sky-300 transition-colors p-6 text-center cursor-pointer">
                <UploadCloud className="size-8 text-sky-500 mx-auto mb-2" />
                <p className="text-sm font-medium">Surat Keterangan Lulus (SKL)</p>
                <p className="text-xs text-slate-500 mt-1">Format PDF/JPG max 2MB</p>
                <button className="mt-3 bg-sky-50 text-sky-600 px-4 py-1.5 rounded-full text-xs font-semibold">Pilih File</button>
              </div>
            </div>
          )}
        </div>

        <footer className="absolute bottom-0 w-full border-t border-slate-100 bg-white p-4 flex gap-3">
          {step > 1 && (
            <button 
              onClick={() => setStep(step - 1)}
              disabled={isSubmitting}
              className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-700 disabled:opacity-50"
            >
              Kembali
            </button>
          )}
          <button 
            onClick={() => step < totalSteps ? setStep(step + 1) : handleSubmit()}
            disabled={isSubmitting}
            className="flex-[2] rounded-xl bg-sky-500 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/20 flex justify-center items-center gap-2 hover:bg-sky-600 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Mengirim..." : step === totalSteps ? "Kirim Pendaftaran" : "Selanjutnya"}
            {step < totalSteps && <ChevronRight className="size-4" />}
          </button>
        </footer>
      </main>
    </div>
  )
}
