import Link from "next/link";
import { CheckCircle, Clock, Download, Eye, XCircle } from "lucide-react";

import { decideSubmissionAction } from "@/app/(tenant)/[domain]/(authenticated)/ppdb/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PpdbSubmission } from "@/lib/ppdb-submission";

function formatAnswer(value: unknown) {
  if (value === undefined || value === null || String(value).trim() === "") return "–";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function SubmissionFormDetail({ domain, submission }: { domain: string; submission: PpdbSubmission }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" size="sm" variant="outline" />}>
        <Eye className="size-3.5" />
        Lihat Isian
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Isian Form {submission.studentName}</DialogTitle>
          <DialogDescription>
            Data ditampilkan berdasarkan snapshot form saat pendaftaran {submission.registrationCode} dikirim.
          </DialogDescription>
        </DialogHeader>
        {submission.formFields.length ? (
          <dl className="grid gap-3 sm:grid-cols-2">
            {submission.formFields.map((field) => {
              const document = field.type === "file"
                ? submission.documents.find((item) => item.fieldId === field.id)
                : null;
              return (
                <div key={field.id} className="rounded-lg border border-slate-200 p-3">
                  <dt className="text-xs font-medium text-slate-500">
                    {field.label} · {field.required ? "Wajib" : "Opsional"}
                  </dt>
                  <dd className="mt-1 break-words text-sm font-medium text-slate-900">
                    {field.type === "file" ? (
                      document ? (
                        <Link
                          href={`/${domain}/ppdb/submissions/${submission.id}/documents/${document.id}`}
                          className="inline-flex items-center gap-1 text-sky-700 hover:underline"
                        >
                          <Download className="size-3.5" />
                          {document.originalFileName}
                        </Link>
                      ) : "–"
                    ) : formatAnswer(submission.formData[field.id])}
                  </dd>
                </div>
              );
            })}
          </dl>
        ) : (
          <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
            Snapshot struktur form tidak tersedia untuk pendaftaran ini.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

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
          <TableHead className="font-semibold">Data Form</TableHead>
          <TableHead className="font-semibold text-center">Skor</TableHead>
          <TableHead className="font-semibold">Dokumen</TableHead>
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
            <TableCell className="text-slate-500">{submission.nisn || "–"}</TableCell>
            <TableCell><SubmissionFormDetail domain={domain} submission={submission} /></TableCell>
            <TableCell className="text-center">{submission.score ?? "–"}</TableCell>
            <TableCell>
              {submission.documents.length ? (
                <div className="flex flex-col gap-1">
                  {submission.documents.map((document) => (
                    <Link
                      key={document.id}
                      href={`/${domain}/ppdb/submissions/${submission.id}/documents/${document.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:underline"
                    >
                      <Download className="size-3.5" />
                      {document.originalFileName}
                    </Link>
                  ))}
                </div>
              ) : "–"}
            </TableCell>
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
