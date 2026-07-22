"use client";

import { useState } from "react";
import { Download, Eye } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import type { PpdbSubmissionDocument } from "@/lib/ppdb-submission";

export function DocumentPreview({
  domain,
  submissionId,
  document,
  fieldLabel,
  showLabel = false,
}: {
  domain: string;
  submissionId: string;
  document: PpdbSubmissionDocument;
  fieldLabel: string;
  showLabel?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const documentUrl = `/${domain}/ppdb/submissions/${submissionId}/documents/${document.id}`;

  async function downloadDocument() {
    setDownloading(true);
    try {
      const response = await fetch(`${documentUrl}?download=1`);
      if (!response.ok) throw new Error("Dokumen gagal diunduh.");

      const objectUrl = URL.createObjectURL(await response.blob());
      const link = window.document.createElement("a");
      link.href = objectUrl;
      link.download = document.originalFileName;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast.error("Dokumen gagal diunduh. Silakan coba lagi.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog onOpenChange={(open) => {
      if (open) setLoaded(false);
    }}>
      <div className="flex items-center gap-1">
        <DialogTrigger render={<Button type="button" variant="ghost" className="h-auto min-w-0 justify-start px-1.5 py-1 text-sky-700" />}>
          <Eye className="size-3.5 shrink-0" />
          {/*<span className="truncate">{document.originalFileName}</span>*/}
          {showLabel && <span className="truncate">Preview</span>}
        </DialogTrigger>
        <Button
          type="button"
          // className="h-0.5"
          variant="ghost"
          disabled={downloading}
          aria-label={`Unduh ${document.originalFileName}`}
          onClick={downloadDocument}
        >
          {downloading ? <Spinner aria-hidden="true" /> : <Download className="size-3.5" />}
          {showLabel && <span className="truncate">{downloading ? "Mengunduh…" : "Unduh"}</span>}
        </Button>
      </div>
      <DialogContent className="h-[90dvh] max-h-[90dvh] grid-rows-[auto_minmax(0,1fr)] sm:max-w-5xl">
        <DialogHeader className="pr-10">
          <DialogTitle className="truncate">{document.originalFileName}</DialogTitle>
          <DialogDescription>
            Dikirim untuk field <span className="font-semibold text-slate-700">{fieldLabel}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="relative min-h-0">
          {!loaded ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500" role="status" aria-live="polite">
              <Spinner aria-hidden="true" />
              Memuat dokumen…
            </div>
          ) : null}
          <iframe
            src={documentUrl}
            title={`Preview ${document.originalFileName}`}
            onLoad={() => setLoaded(true)}
            className="h-full min-h-0 w-full rounded-xl border border-slate-200 bg-slate-50"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
