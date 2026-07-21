import { notFound } from "next/navigation"

import { PpdbApplyForm } from "@/app/apply/[domain]/apply-form"
import { resolvePublicTenant } from "@/app/apply/[domain]/resolve-tenant"
import { PpdbSessionClosedNotice } from "@/app/apply/[domain]/session-closed-notice"
import { findPublicPpdbSession } from "@/lib/ppdb-session-data"

export default async function PPDBStudentPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params
  const tenant = await resolvePublicTenant(domain)
  if (!tenant) notFound()

  // URL ini dibagikan permanen di setiap Sesi PPDB sekolah — bisa saja belum dibuka, sedang berjalan, atau sudah ditutup.
  const session = await findPublicPpdbSession(tenant.id)
  if (!session) return <PpdbSessionClosedNotice />

  return <PpdbApplyForm domain={domain} fields={session.fields} nisnRequired={tenant.nisnRequired} />
}
