import { notFound } from "next/navigation"

import { resolvePublicTenant } from "@/app/apply/[domain]/resolve-tenant"
import { PpdbStatusCheckForm } from "@/app/apply/[domain]/status/status-check-form"

export default async function PpdbStatusPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params
  const tenant = await resolvePublicTenant(domain)
  if (!tenant) notFound()

  return <PpdbStatusCheckForm domain={domain} nisnRequired={tenant.nisnRequired} />
}
