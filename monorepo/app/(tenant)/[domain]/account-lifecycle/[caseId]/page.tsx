import { consumeLifecycleCaseAction } from "./actions";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { tenant, tenantAccountLifecycleCase } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default async function LifecycleCasePage({ params, searchParams }: { params: Promise<{ domain: string; caseId: string }>; searchParams: Promise<{ status?: string; error?: string }> }) {
  const { domain, caseId } = await params;
  const [lifecycleCase] = await db.select({ id: tenantAccountLifecycleCase.id }).from(tenantAccountLifecycleCase).innerJoin(tenant, eq(tenant.id, tenantAccountLifecycleCase.tenantId)).where(and(eq(tenant.domain, domain), eq(tenantAccountLifecycleCase.id, caseId))).limit(1);
  if (!lifecycleCase) notFound();
  const { status, error } = await searchParams;
  return <main className="mx-auto flex min-h-screen max-w-lg items-center p-6"><Card className="w-full"><CardHeader><CardTitle>{status ? "Permintaan berhasil diproses" : "Aktivasi atau pemulihan akun"}</CardTitle><CardDescription>{status ? "Silakan lanjutkan ke halaman masuk." : "Masukkan secret sekali pakai yang diberikan bersama instruksi akun."}</CardDescription></CardHeader><CardContent>{status ? <p className="text-sm text-muted-foreground">Status: {status}</p> : <form action={consumeLifecycleCaseAction.bind(null, domain, caseId)} className="space-y-4"><Input aria-label="Secret sekali pakai" autoComplete="one-time-code" name="secret" required type="password" /><Button type="submit">Konfirmasi</Button>{error ? <p className="text-sm text-destructive">Secret tidak valid atau sudah kedaluwarsa.</p> : null}</form>}</CardContent></Card></main>;
}
