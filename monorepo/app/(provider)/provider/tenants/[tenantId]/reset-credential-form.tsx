"use client";

import { useActionState } from "react";

import { resetTemporaryCredentialAction, type ResetCredentialState } from "@/app/(provider)/provider/tenants/[tenantId]/actions";
import { Button } from "@/components/ui/button";

const initialState: ResetCredentialState = { status: "idle" };

export function ResetCredentialForm({ userId }: { userId: string }) {
  const action = resetTemporaryCredentialAction.bind(null, userId);
  const [state, formAction, pending] = useActionState(action, initialState);

  if (state.status === "reset") {
    return (
      <div className="space-y-2" role="status">
        <p className="text-sm font-medium">Kredensial pengganti (hanya ditampilkan sekali)</p>
        <code className="block break-all rounded-md bg-muted p-3">{state.temporaryCredential}</code>
      </div>
    );
  }
  if (state.status === "recovery-required") {
    return <p className="text-sm" role="alert">School Admin sudah pernah login. Gunakan alur lupa kata sandi Better Auth.</p>;
  }
  return (
    <form action={formAction} className="space-y-3">
      {state.status === "error" ? <p className="text-sm text-destructive" role="alert">Kredensial sementara gagal direset.</p> : null}
      <p className="text-xs text-muted-foreground">Reset mencabut semua sesi dan kredensial lama. Rahasia baru hanya tersedia pada respons ini.</p>
      <Button disabled={pending} type="submit" variant="destructive">
        {pending ? "Mereset…" : "Reset kredensial sementara"}
      </Button>
    </form>
  );
}
