"use client";

import { useActionState } from "react";

import {
  updateLandingPageAction,
  type LandingPageActionState,
} from "@/app/(tenant)/[domain]/(authenticated)/settings/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAX_TENANT_LANDING_PAGE_HTML_LENGTH } from "@/lib/tenancy/tenant-landing-page";

const initialState: LandingPageActionState = { status: "idle" };

export function LandingPageForm({ domain, initialHtml }: { domain: string; initialHtml: string }) {
  const [state, formAction, pending] = useActionState(
    updateLandingPageAction.bind(null, domain),
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="landing-page-html">HTML landing page</Label>
        <Textarea
          className="min-h-96 resize-y font-mono text-xs"
          defaultValue={initialHtml}
          id="landing-page-html"
          maxLength={MAX_TENANT_LANDING_PAGE_HTML_LENGTH}
          name="html"
          placeholder={'<!doctype html>\n<html lang="id">...</html>'}
          spellCheck={false}
        />
        <p className="text-xs text-muted-foreground">
          Kosongkan HTML untuk memakai landing page bawaan. Placeholder yang tersedia: <code>{"{{TENANT_NAME}}"}</code>, <code>{"{{LOGIN_URL}}"}</code>, dan <code>{"{{PPDB_URL}}"}</code>.
        </p>
      </div>
      {state.status === "saved" ? (
        <p className="text-sm text-emerald-700" role="status">Landing page berhasil disimpan.</p>
      ) : state.status === "error" ? (
        <p className="text-sm text-destructive" role="alert">{state.message}</p>
      ) : null}
      <Button disabled={pending} type="submit">
        {pending ? "Menyimpan…" : "Simpan landing page"}
      </Button>
    </form>
  );
}
