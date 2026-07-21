import { notFound } from "next/navigation"

import { resolvePublicTenantId } from "@/app/apply/[domain]/resolve-tenant"
import { PpdbStatusCheckForm } from "@/app/apply/[domain]/status/status-check-form"

export default async function PpdbStatusPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params
  const tenantId = await resolvePublicTenantId(domain)
  if (!tenantId) notFound()

  return <PpdbStatusCheckForm domain={domain} />
}
