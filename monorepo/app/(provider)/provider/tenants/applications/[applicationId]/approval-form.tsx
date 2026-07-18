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
            Salin kredensial sementara ini sekarang. Kredensial tidak dapat
            ditampilkan kembali setelah meninggalkan halaman ini.
          </p>
        </div>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs font-medium uppercase text-muted-foreground">Email School Admin</dt>
            <dd className="mt-1 break-all font-mono">{state.schoolAdminEmail}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-muted-foreground">Kredensial sementara</dt>
            <dd className="mt-1 break-all rounded-md border bg-muted p-3 font-mono text-base">
              {state.temporaryCredential}
            </dd>
          </div>
        </dl>
        <Link className={buttonVariants({ className: "w-full" })} href={`/provider/tenants/${state.tenantId}`}>
          Lihat Tenant
        </Link>
      </div>
    );
  }

  if (state.status === "already-approved") {
    return (
      <div className="space-y-4" role="status">
        <p className="text-sm">Pengajuan ini sudah disetujui. Kredensial sementara tidak diterbitkan ulang.</p>
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
