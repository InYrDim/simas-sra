"use client";

import { useActionState, type ReactNode } from "react";

import { manageClassRelationshipAction, type ManageClassRelationshipState } from "@/app/(tenant)/[domain]/(authenticated)/master/rombel/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const initialState: ManageClassRelationshipState = { status: "idle" };

export function PreviewedRelationshipForm({ domain, className, submitLabel, children }: { domain: string; className?: string; submitLabel: string; children: ReactNode }) {
  const [state, action, pending] = useActionState(manageClassRelationshipAction.bind(null, domain), initialState);
  return <form action={action} className={className}>
    {children}
    {state.status !== "idle" ? <Alert variant={state.status === "error" ? "destructive" : "default"} role={state.status === "error" ? "alert" : "status"}><AlertDescription>{state.message}</AlertDescription></Alert> : null}
    <Button type="submit" disabled={pending}>{pending ? "Memproses…" : state.status === "preview" ? "Konfirmasi dan simpan" : `Tinjau ${submitLabel}`}</Button>
  </form>;
}
