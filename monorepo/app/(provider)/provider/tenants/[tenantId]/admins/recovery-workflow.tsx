"use client";

import { useActionState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  completeSchoolAdminRecoveryProofAction,
  initialState,
  reactivateSchoolAdminRecoveryAction,
  startSchoolAdminRecoveryAction,
  type RecoveryActionState,
} from "./recovery-actions";

type RecoveryWorkflowProps = Readonly<{
  tenantId: string;
  authorityId: string;
  authorityVersion: number;
}>;

function Status({ state }: { state: RecoveryActionState }) {
  if (state.status === "idle") return null;
  return (
    <div className="space-y-1" aria-live="polite">
      <Badge variant={state.status === "error" || state.status === "stale" ? "destructive" : "secondary"}>
        {state.status === "started" ? "Proof menunggu" : state.status === "proof-completed" ? "Proof selesai" : state.status === "reactivated" ? "Aktif kembali" : state.status === "stale" ? "Versi kedaluwarsa" : state.status === "error" ? "Gagal" : "Memproses"}
      </Badge>
      {state.message ? <p className="text-sm text-muted-foreground">{state.message}</p> : null}
      {state.correlationId ? <p className="font-mono text-xs text-muted-foreground">Correlation ID: {state.correlationId}</p> : null}
    </div>
  );
}

export function SchoolAdminRecoveryWorkflow({ tenantId, authorityId, authorityVersion }: RecoveryWorkflowProps) {
  const [startState, startAction, startPending] = useActionState(
    startSchoolAdminRecoveryAction.bind(null, tenantId, authorityId, authorityVersion),
    initialState,
  );
  const [proofState, proofAction, proofPending] = useActionState(
    completeSchoolAdminRecoveryProofAction.bind(null, tenantId, startState.caseId ?? "", startState.proofVersion ?? 1, startState.authorityVersion ?? authorityVersion),
    initialState,
  );
  const [reactivateState, reactivateAction, reactivatePending] = useActionState(
    reactivateSchoolAdminRecoveryAction.bind(null, tenantId, proofState.caseId ?? startState.caseId ?? "", authorityId, proofState.authorityVersion ?? authorityVersion, proofState.proofVersion ?? 2),
    initialState,
  );
  const state = reactivateState.status !== "idle" ? reactivateState : proofState.status !== "idle" ? proofState : startState;

  return (
    <div className="space-y-3 rounded-md border border-dashed p-3" aria-label="Alur recovery forward-only">
      {startState.status === "idle" || startState.status === "error" || startState.status === "stale" ? (
        <form action={startAction} className="space-y-2">
          <label className="text-sm font-medium" htmlFor={`recovery-reason-${authorityId}`}>Alasan recovery</label>
          <Input id={`recovery-reason-${authorityId}`} name="reason" required maxLength={1000} placeholder="Contoh: pemulihan akses sesuai case support" />
          <Button disabled={startPending} type="submit">{startPending ? "Memulai recovery…" : "Mulai recovery"}</Button>
        </form>
      ) : null}
      {startState.status === "started" && startState.secret ? (
        <div className="space-y-2 rounded-md bg-muted p-3" role="status">
          <p className="text-sm font-medium">Secret proof satu kali</p>
          <code className="block break-all text-xs">{startState.secret}</code>
          <p className="text-xs text-muted-foreground">Simpan secara aman. Secret tidak ditulis ulang ke audit dan tidak mengaktifkan authority.</p>
          <form action={proofAction} className="space-y-2">
            <label className="text-sm font-medium" htmlFor={`proof-secret-${authorityId}`}>Masukkan secret untuk verifikasi</label>
            <Input id={`proof-secret-${authorityId}`} name="secret" required type="password" autoComplete="one-time-code" />
            <Button disabled={proofPending} type="submit">{proofPending ? "Memverifikasi proof…" : "Selesaikan proof"}</Button>
          </form>
        </div>
      ) : null}
      {proofState.status === "proof-completed" ? (
        <form action={reactivateAction}>
          <Button disabled={reactivatePending} type="submit" variant="secondary">{reactivatePending ? "Mengaktifkan kembali…" : "Konfirmasi reaktivasi authority"}</Button>
        </form>
      ) : null}
      <Status state={state} />
    </div>
  );
}
