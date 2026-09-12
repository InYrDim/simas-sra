"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  approveSimasApplicationAction,
  type ApprovalActionState,
} from "@/app/(provider)/provider/tenants/applications/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ApprovalActionState = { status: "idle" };

export function ApprovalForm({
  applicationId,
  defaultSubdomain,
}: {
  applicationId: string;
  defaultSubdomain: string;
}) {
  const action = approveSimasApplicationAction.bind(null, applicationId);
  const [state, formAction, pending] = useActionState(action, initialState);

  if (state.status === "approved") {
    return (
      <div className="space-y-4" role="status">
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <h3 className="font-semibold">Tenant berhasil disediakan</h3>
          <p className="mt-2 text-sm">
            Pemohon existing telah dipromosikan menjadi School Admin. Seluruh sesi lamanya dicabut dan tidak ada kredensial sementara yang diterbitkan.
          </p>
        </div>

        <Link className={buttonVariants({ className: "w-full" })} href={`/provider/tenants/${state.tenantId}`}>
          Lihat Tenant
        </Link>
      </div>
    );
  }

  if (state.status === "already-approved") {
    return (
      <div className="space-y-4" role="status">
        <p className="text-sm">Pengajuan ini sudah disetujui dan Pemohon telah dipromosikan menggunakan akun existing.</p>
        <Link className={buttonVariants({ className: "w-full" })} href={`/provider/tenants/${state.tenantId}`}>
          Lihat Tenant
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.status === "error" ? (
        <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="subdomain">Subdomain Tenant</Label>
        <Input
          autoCapitalize="none"
          autoCorrect="off"
          defaultValue={state.status === "error" ? state.subdomain : defaultSubdomain}
          id="subdomain"
          maxLength={63}
          name="subdomain"
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          required
          spellCheck={false}
        />
        <p className="text-xs text-muted-foreground">
          Saran dibuat dari nama sekolah. Anda dapat mengubahnya sebelum menyetujui.
        </p>
      </div>
      <Button className="w-full" disabled={pending} type="submit">
        {pending ? "Menyediakan Tenant…" : "Setujui dan sediakan Tenant"}
      </Button>
    </form>
  );
}
