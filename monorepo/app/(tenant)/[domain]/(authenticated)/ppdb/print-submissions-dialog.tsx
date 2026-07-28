"use client";

import { useMemo, useState } from "react";
import { Printer } from "lucide-react";

import {
  getPpdbDynamicPrintColumns,
  ppdbSystemPrintColumns,
  printPpdbSubmissionsList,
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
  const availableColumns = useMemo(
    () => [...ppdbSystemPrintColumns, ...getPpdbDynamicPrintColumns(submissions)],
    [submissions],
  );
  const [columns, setColumns] = useState<Set<string>>(() => new Set(ppdbSystemPrintColumns.map(({ key }) => key)));
  const [statuses, setStatuses] = useState<Set<PpdbSubmissionStatus>>(() => new Set(printStatuses.map(({ value }) => value)));
  const filteredSubmissions = useMemo(
    () => submissions.filter((submission) => statuses.has(submission.status)),
    [statuses, submissions],
  );

  function toggleColumn(column: string, checked: boolean) {
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
    const selectedColumns = availableColumns.filter((column) => columns.has(column.key));
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
          <fieldset className="max-h-72 space-y-3 overflow-y-auto rounded-xl border border-slate-200 p-4">
            <legend className="px-1 font-semibold">Kolom yang dicetak</legend>
            {availableColumns.map((column, index) => {
              const id = `print-column-${index}`;
              const dynamic = column.key.startsWith("field:");
              return (
                <Label key={column.key} htmlFor={id} className="flex cursor-pointer items-center gap-3 font-normal">
                  <Checkbox
                    id={id}
                    checked={columns.has(column.key)}
                    onCheckedChange={(checked) => toggleColumn(column.key, checked === true)}
                  />
                  <span>{column.label}{dynamic ? <span className="block text-xs text-slate-400">Field formulir</span> : null}</span>
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
