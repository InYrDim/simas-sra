"use client";

import { useMemo, useState } from "react";
import { Printer } from "lucide-react";

import {
  printPpdbSubmissionsList,
  type PpdbPrintColumn,
} from "@/app/(tenant)/[domain]/(authenticated)/ppdb/submissions-list-printer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { PpdbSubmission, PpdbSubmissionStatus } from "@/lib/ppdb-submission";

const printColumns: readonly { value: PpdbPrintColumn; label: string }[] = [
  { value: "registrationCode", label: "Kode pendaftaran" },
  { value: "studentName", label: "Nama peserta" },
  { value: "nisn", label: "NISN" },
  { value: "score", label: "Skor" },
  { value: "submittedAt", label: "Tanggal daftar" },
  { value: "status", label: "Status" },
];

const printStatuses: readonly { value: PpdbSubmissionStatus; label: string }[] = [
  { value: "pending", label: "Menunggu" },
  { value: "accepted", label: "Diterima" },
  { value: "rejected", label: "Ditolak" },
];

export function PrintSubmissionsDialog({
  domain,
  submissions,
}: {
  domain: string;
  submissions: readonly PpdbSubmission[];
}) {
  const [columns, setColumns] = useState<Set<PpdbPrintColumn>>(() => new Set(printColumns.map(({ value }) => value)));
  const [statuses, setStatuses] = useState<Set<PpdbSubmissionStatus>>(() => new Set(printStatuses.map(({ value }) => value)));
  const filteredSubmissions = useMemo(
    () => submissions.filter((submission) => statuses.has(submission.status)),
    [statuses, submissions],
  );

  function toggleColumn(column: PpdbPrintColumn, checked: boolean) {
    setColumns((current) => {
      const next = new Set(current);
      if (checked) next.add(column);
      else next.delete(column);
      return next;
    });
  }

  function toggleStatus(status: PpdbSubmissionStatus, checked: boolean) {
    setStatuses((current) => {
      const next = new Set(current);
      if (checked) next.add(status);
      else next.delete(status);
      return next;
    });
  }

  function print() {
    const selectedColumns = printColumns.map(({ value }) => value).filter((column) => columns.has(column));
    printPpdbSubmissionsList({ domain, submissions: filteredSubmissions, columns: selectedColumns });
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="outline" className="gap-2" />}>
        <Printer className="size-4" />
        Cetak daftar
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Cetak daftar calon siswa</DialogTitle>
          <DialogDescription>
            Pilih kolom dan status pendaftar yang ingin dimasukkan ke dokumen PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 sm:grid-cols-2">
          <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4">
            <legend className="px-1 font-semibold">Kolom yang dicetak</legend>
            {printColumns.map((column) => {
              const id = `print-column-${column.value}`;
              return (
                <Label key={column.value} htmlFor={id} className="flex cursor-pointer items-center gap-3 font-normal">
                  <Checkbox
                    id={id}
                    checked={columns.has(column.value)}
                    onCheckedChange={(checked) => toggleColumn(column.value, checked === true)}
                  />
                  {column.label}
                </Label>
              );
            })}
          </fieldset>

          <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4">
            <legend className="px-1 font-semibold">Status pendaftar</legend>
            {printStatuses.map((status) => {
              const id = `print-status-${status.value}`;
              return (
                <Label key={status.value} htmlFor={id} className="flex cursor-pointer items-center gap-3 font-normal">
                  <Checkbox
                    id={id}
                    checked={statuses.has(status.value)}
                    onCheckedChange={(checked) => toggleStatus(status.value, checked === true)}
                  />
                  {status.label}
                </Label>
              );
            })}
          </fieldset>
        </div>

        <p className="text-sm text-slate-500">
          {filteredSubmissions.length} dari {submissions.length} calon siswa akan dicetak.
        </p>

        <DialogFooter className="border-t border-slate-200 pt-4">
          <Button
            type="button"
            onClick={print}
            disabled={columns.size === 0 || filteredSubmissions.length === 0}
            className="gap-2"
          >
            <Printer className="size-4" />
            Cetak PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
