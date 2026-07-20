import { Suspense } from "react"

import { TenantClosurePrototype } from "./tenant-closure-prototype"

// PROTOTYPE — Three variants of the cross-role Tenant closure journey, switchable via ?variant=, on /tenant-closure-prototype.
export default function TenantClosurePrototypePage() {
  return <Suspense><TenantClosurePrototype /></Suspense>
}
