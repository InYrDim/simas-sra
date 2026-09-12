import { notFound } from "next/navigation"

import { PpdbApplyForm } from "@/app/ppdb/[domain]/apply-form"
import { resolvePublicTenant } from "@/app/ppdb/[domain]/resolve-tenant"
import { PpdbSessionClosedNotice } from "@/app/ppdb/[domain]/session-closed-notice"
import { findPublicPpdbSession } from "@/lib/admissions/ppdb-session-data"

export default async function PpdbSessionApplicationPage({
  params,
}: {
  params: Promise<{ domain: string; sessionId: string }>
}) {
  const { domain, sessionId } = await params
  const tenant = await resolvePublicTenant(domain)
  if (!tenant) notFound()

  const session = await findPublicPpdbSession(tenant.id, sessionId)
  if (!session?.fields.length) return <PpdbSessionClosedNotice />

  return (
    <PpdbApplyForm
      domain={domain}
      sessionId={session.id}
      fields={session.fields}
      nisnRequired={tenant.nisnRequired}
    />
  )
}
