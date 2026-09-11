"use client";

import { useActionState } from "react";
import { Check, Phone, X } from "lucide-react";

import {
  fulfillWhatsAppBotRequestAction,
  reviewWhatsAppBotRequestAction,
  type WhatsAppBotRequestFulfillState,
  type WhatsAppBotRequestReviewState,
} from "@/app/(provider)/provider/features/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

export type WhatsAppProviderRequestView = {
  id: string;
  tenantName: string;
  tenantNpsn: string;
  tenantDomain: string;
  requestedPhone: string;
  desiredSessionName: string | null;
  picName: string;
  note: string | null;
  status: "pending" | "approved" | "rejected" | "fulfilled";
  providerNote: string | null;
  openwaSessionId: string | null;
  resolutionMethod: "self_service" | "provider" | null;
  resolvedAt: string | null;
  createdAt: string;
};

const timeFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" });

function statusLabel(status: WhatsAppProviderRequestView["status"]): string {
  switch (status) {
    case "pending":
      return "Perlu Persetujuan";
    case "approved":
      return "Disetujui";
    case "rejected":
      return "Ditolak";
    case "fulfilled":
      return "Selesai";
  }
}

function statusVariant(status: WhatsAppProviderRequestView["status"]): "destructive" | "secondary" {
  return status === "rejected" ? "destructive" : "secondary";
}

function ReviewForm({ request }: { request: WhatsAppProviderRequestView }) {
  const [state, action, pending] = useActionState<WhatsAppBotRequestReviewState, FormData>(
    (previous, formData) => reviewWhatsAppBotRequestAction(request.id, previous, formData),
    { status: "idle" },
  );

  return (
    <form className="grid gap-3" action={action}>
      <Textarea
        name="note"
        placeholder="Catatan untuk sekolah (wajib saat ditolak, ditampilkan di halaman integrasi)"
        rows={2}
      />
      {state.status === "saved" ? (
        <p className="rounded-md border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-600">
          {state.message}
        </p>
      ) : null}
      {state.status === "error" ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="decision" value="approve" disabled={pending}>
          {pending ? <Spinner aria-hidden="true" /> : <Check aria-hidden="true" />}
          Setujui
        </Button>
        <Button
          type="submit"
          name="decision"
          value="reject"
          variant="destructive"
          disabled={pending}
        >
          {pending ? <Spinner aria-hidden="true" /> : <X aria-hidden="true" />}
          Tolak
        </Button>
      </div>
    </form>
  );
}

export function WhatsAppRequestReviewList({
  requests,
}: {
  requests: WhatsAppProviderRequestView[];
}) {
  return (
    <div className="space-y-4">
      {requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {`Belum ada pengajuan WhatsApp Bot untuk tenant ini.`}
        </p>
      ) : (
        requests.map((request) => (
          <article key={request.id} className="space-y-3 rounded-xl border p-4">
            <header className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <Phone aria-hidden="true" className="size-4 text-muted-foreground" />
                {request.requestedPhone}
              </h3>
              <Badge variant={statusVariant(request.status)}>{statusLabel(request.status)}</Badge>
            </header>

            <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
              <div className="space-y-0.5">
                <dt className="text-muted-foreground">PIC</dt>
                <dd>{request.picName}</dd>
              </div>
              <div className="space-y-0.5">
                <dt className="text-muted-foreground">Diajukan</dt>
                <dd>{timeFormat.format(new Date(request.createdAt))}</dd>
              </div>
              {request.desiredSessionName ? (
                <div className="space-y-0.5">
                  <dt className="text-muted-foreground">Usulan nama sesi</dt>
                  <dd className="font-mono">{request.desiredSessionName}</dd>
                </div>
              ) : null}
              {request.openwaSessionId ? (
                <div className="space-y-0.5">
                  <dt className="text-muted-foreground">Session ID</dt>
                  <dd className="font-mono text-xs">{request.openwaSessionId}</dd>
                </div>
              ) : null}
              {request.note ? (
                <div className="space-y-0.5 sm:col-span-2">
                  <dt className="text-muted-foreground">Keperluan</dt>
                  <dd className="max-w-prose whitespace-pre-wrap">{request.note}</dd>
                </div>
              ) : null}
              {request.providerNote ? (
                <div className="space-y-0.5 sm:col-span-2">
                  <dt className="text-muted-foreground">Catatan Provider</dt>
                  <dd className="max-w-prose whitespace-pre-wrap">{request.providerNote}</dd>
                </div>
              ) : null}
              {request.resolvedAt ? (
                <div className="space-y-0.5">
                  <dt className="text-muted-foreground">Diproses</dt>
                  <dd>{timeFormat.format(new Date(request.resolvedAt))}</dd>
                </div>
              ) : null}
            </dl>

            {request.status === "pending" ? <ReviewForm request={request} /> : null}
            {request.status === "approved" ? <FulfillForm requestId={request.id} /> : null}
          </article>
        ))
      )}
    </div>
  );
}

function FulfillForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState<
    WhatsAppBotRequestFulfillState,
    FormData
  >((previous, _formData) => fulfillWhatsAppBotRequestAction(requestId, previous, _formData), {
    status: "idle",
  });

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? <Spinner aria-hidden="true" /> : <Check aria-hidden="true" />}
        {pending ? "Menyimpan…" : "Tandai Selesai (kredensial sudah diisi)"}
      </Button>
      {state.status === "saved" ? (
        <span className="flex items-center gap-1.5 text-sm text-emerald-600">
          <Check aria-hidden="true" className="size-4" />
          Pengajuan ditandai selesai.
        </span>
      ) : null}
      {state.status === "error" ? (
        <span className="text-sm text-destructive">Gagal menandai selesai.</span>
      ) : null}
    </form>
  );
}