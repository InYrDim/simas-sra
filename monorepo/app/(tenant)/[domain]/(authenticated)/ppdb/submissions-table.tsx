import { CheckCircle, Clock, XCircle } from "lucide-react";

import { decideSubmissionAction } from "@/app/(tenant)/[domain]/(authenticated)/ppdb/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PpdbSubmission } from "@/lib/ppdb-submission";

function StatusBadge({ status }: { status: PpdbSubmission["status"] }) {
  if (status === "accepted") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <CheckCircle className="size-3.5" /> Diterima
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
        <XCircle className="size-3.5" /> Ditolak
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
      <Clock className="size-3.5" /> Menunggu
    </span>
  );
}

// Terima/Tolak tetap bisa dilakukan meski Sesi induknya sudah diakhiri — hanya submission baru & struktur Form yang terkunci.
export function SubmissionsTable({
  domain,
  submissions,
  writable,
  redirectPath,
}: {
  domain: string;
  submissions: readonly PpdbSubmission[];
  writable: boolean;
  redirectPath: string;
}) {
  if (!submissions.length) {
    return <p className="p-6 text-center text-sm text-slate-500">Belum ada pendaftar untuk Sesi ini.</p>;
  }
  return (
    <Table>
      <TableHeader className="bg-slate-50">
        <TableRow>
          <TableHead className="font-semibold">Kode Pendaftaran</TableHead>
          <TableHead className="font-semibold">Nama Peserta</TableHead>
          <TableHead className="font-semibold">NISN</TableHead>
          <TableHead className="font-semibold text-center">Skor</TableHead>
          <TableHead className="font-semibold">Tanggal</TableHead>
          <TableHead className="font-semibold">Status</TableHead>
          {writable ? <TableHead className="font-semibold text-right">Aksi</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {submissions.map((submission) => (
          <TableRow key={submission.id}>
            <TableCell className="font-medium">{submission.registrationCode}</TableCell>
            <TableCell className="font-semibold text-slate-900">{submission.studentName}</TableCell>
            <TableCell className="text-slate-500">{submission.nisn}</TableCell>
            <TableCell className="text-center">{submission.score ?? "–"}</TableCell>
            <TableCell className="text-slate-500">{submission.submittedAt.toLocaleDateString("id-ID")}</TableCell>
            <TableCell>
              <StatusBadge status={submission.status} />
            </TableCell>
            {writable ? (
              <TableCell className="text-right">
                <form action={decideSubmissionAction.bind(null, domain)} className="flex items-center justify-end gap-2">
                  <input type="hidden" name="submissionId" value={submission.id} />
                  <input type="hidden" name="redirectPath" value={redirectPath} />
                  <Input
                    aria-label="Skor"
                    name="score"
                    type="number"
                    defaultValue={submission.score ?? ""}
                    className="h-9 w-20"
                  />
                  <Button type="submit" name="status" value="accepted" size="sm" variant="outline" className="border-emerald-600 text-emerald-700 hover:bg-emerald-50">
                    Terima
                  </Button>
                  <Button type="submit" name="status" value="rejected" size="sm" variant="outline" className="border-red-600 text-red-700 hover:bg-red-50">
                    Tolak
                  </Button>
                </form>
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
