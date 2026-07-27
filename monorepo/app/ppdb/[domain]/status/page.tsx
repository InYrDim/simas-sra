import { notFound } from "next/navigation"

import { resolvePublicTenant } from "@/app/ppdb/[domain]/resolve-tenant"
import { PpdbStatusCheckForm } from "@/app/ppdb/[domain]/status/status-check-form"
import { findPublicPpdbSession } from "@/lib/ppdb-session-data"

export default async function PpdbStatusPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params
  const tenant = await resolvePublicTenant(domain)
  if (!tenant) notFound()
  const session = await findPublicPpdbSession(tenant.id)
  if (!session) notFound()

  return <PpdbStatusCheckForm domain={domain} sessionId={session.id} nisnRequired={tenant.nisnRequired} />
}
