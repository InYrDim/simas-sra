import { Search, Filter, CheckCircle, XCircle, Clock, Eye, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"

// TODO: Replace with real database call
const getMockData = async (domain: string) => {
  return [
    { id: "REG-001", name: "Ahmad Budi", nisn: "0012345678", status: "pending", date: "2026-07-20", score: 85 },
    { id: "REG-002", name: "Siti Aminah", nisn: "0023456789", status: "accepted", date: "2026-07-19", score: 92 },
    { id: "REG-003", name: "Bagus Pratama", nisn: "0034567890", status: "rejected", date: "2026-07-18", score: 65 },
  ]
}

export default async function PPDBDashboardPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params
  const data = await getMockData(domain)

  return (
    <main className="min-h-svh bg-slate-50 text-slate-950 pb-20">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Review Pendaftaran PPDB</h1>
          <p className="text-sm text-slate-500">Domain: {domain} • Tahun Ajaran 2026/2027</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="flex items-center gap-2">
            <Download className="size-4" />
            Export Data
          </Button>
        </div>
      </header>

      <div className="p-6 h-[calc(100vh-80px)]">
        <div className="mx-auto max-w-6xl h-full flex flex-col">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-4">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
              <Input type="text" placeholder="Cari nama atau NISN..." className="pl-9" />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" className="flex flex-1 items-center justify-center gap-2">
                <Filter className="size-4" />
                Filter Status
              </Button>
            </div>
          </div>
          
          <div className="flex-1 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-semibold">ID Daftar</TableHead>
                  <TableHead className="font-semibold">Nama Peserta</TableHead>
                  <TableHead className="font-semibold">NISN</TableHead>
                  <TableHead className="font-semibold text-center">Skor</TableHead>
                  <TableHead className="font-semibold">Tanggal</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <TableRow key={row.id} className="cursor-pointer">
                    <TableCell className="font-medium">{row.id}</TableCell>
                    <TableCell className="font-semibold text-slate-900">{row.name}</TableCell>
                    <TableCell className="text-slate-500">{row.nisn}</TableCell>
                    <TableCell className="text-center">{row.score}</TableCell>
                    <TableCell className="text-slate-500">{row.date}</TableCell>
                    <TableCell>
                      {row.status === "accepted" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700"><CheckCircle className="size-3.5" /> Diterima</span>
                      ) : row.status === "rejected" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700"><XCircle className="size-3.5" /> Ditolak</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700"><Clock className="size-3.5" /> Menunggu</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="text-sky-600 hover:bg-sky-100 hover:text-sky-700">
                        <Eye className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </main>
  )
}
