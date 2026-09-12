import { consumeLifecycleCaseAction } from "./actions";
import { LifecycleConsumeForm } from "./consume-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function LifecycleCasePage({ params, searchParams }: { params: Promise<{ domain: string; caseId: string }>; searchParams: Promise<{ status?: string; error?: string }> }) {
  const { domain, caseId } = await params;
  const { status, error } = await searchParams;
  const completed = status === "activated" || status === "recovered";
  return <main className="mx-auto flex min-h-screen max-w-lg items-center p-6"><Card className="w-full"><CardHeader><CardTitle>{completed ? "Permintaan berhasil diproses" : "Aktivasi atau pemulihan akun"}</CardTitle><CardDescription>{completed ? "Silakan lanjutkan ke halaman masuk." : "Masukkan secret sekali pakai yang diberikan bersama instruksi akun."}</CardDescription></CardHeader><CardContent>{completed ? <p className="text-sm text-muted-foreground">Permintaan sudah diproses. Secret ini tidak dapat digunakan kembali.</p> : <LifecycleConsumeForm action={consumeLifecycleCaseAction.bind(null, domain, caseId)} hasError={error === "invalid-or-expired"} />}</CardContent></Card></main>;
}
