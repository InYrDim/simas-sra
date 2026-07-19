import type { CentralIdentity } from "@/lib/central-identity";

export type TenantLoginTenant = Readonly<{ id: string; domain: string; name: string }>;

export type TenantLoginStore = Readonly<{
  findByExactDomain(domain: string): Promise<TenantLoginTenant | null>;
}>;

export type TenantLoginResult =
  | { kind: "tenant-not-found" }
  | { kind: "login-required"; tenant: TenantLoginTenant; continuation: string | null }
  | { kind: "redirect"; destination: string };

export type TenantPageAccess =
  | { kind: "tenant-not-found" }
  | { kind: "login-required"; destination: string }
  | { kind: "redirect"; destination: string }
  | { kind: "authorized"; tenant: TenantLoginTenant };

export function sanitizeTenantContinuation(value: string | null | undefined, requestedDomain: string): string | null {
  if (!value || !requestedDomain || value !== value.trim()) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("%")) return null;

  let url: URL;
  try {
    url = new URL(value, "https://tenant.invalid");
  } catch {
    return null;
  }
  if (url.origin !== "https://tenant.invalid" || url.username || url.password || url.hash) return null;
  if (url.pathname.includes("//")) return null;

  const prefix = `/${requestedDomain}`;
  if (url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) return null;
  if (url.pathname.split("/").some((segment) => segment === "." || segment === "..")) return null;

  return `${url.pathname}${url.search}`;
}

function tenantContextDestination(identity: CentralIdentity, requestedTenant: TenantLoginTenant, continuation?: string | null): string {
  if (identity.kind !== "tenant-member") {
    switch (identity.kind) {
      case "provider-admin": return "/provider";
      case "applicant": return "/apply";
      case "invalid": return "/access-error";
    }
  }
  if (identity.passwordChangeRequired) return "/change-password";
  if (identity.tenantId !== requestedTenant.id) return `/${identity.domain}/dashboard`;
  return sanitizeTenantContinuation(continuation, requestedTenant.domain) ?? `/${requestedTenant.domain}/dashboard`;
}

export async function resolveTenantPageAccess(
  store: TenantLoginStore,
  requestedDomain: string,
  identity: CentralIdentity | null,
  continuation?: string | null,
): Promise<TenantPageAccess> {
  const requestedTenant = await store.findByExactDomain(requestedDomain);
  if (!requestedTenant) return { kind: "tenant-not-found" };
  if (!identity) {
    const safeContinuation = sanitizeTenantContinuation(continuation, requestedDomain);
    const query = safeContinuation ? `?continuation=${encodeURIComponent(safeContinuation)}` : "";
    return { kind: "login-required", destination: `/${requestedDomain}/login${query}` };
  }
  if (identity.kind === "tenant-member" && identity.tenantId === requestedTenant.id && !identity.passwordChangeRequired) {
    return { kind: "authorized", tenant: requestedTenant };
  }
  return { kind: "redirect", destination: tenantContextDestination(identity, requestedTenant) };
}

export async function resolveTenantLogin(
  store: TenantLoginStore,
  requestedDomain: string,
  identity: CentralIdentity | null,
  continuation?: string | null,
): Promise<TenantLoginResult> {
  const requestedTenant = await store.findByExactDomain(requestedDomain);
  if (!requestedTenant) return { kind: "tenant-not-found" };
  if (!identity) {
    return {
      kind: "login-required",
      tenant: requestedTenant,
      continuation: sanitizeTenantContinuation(continuation, requestedDomain),
    };
  }
  return { kind: "redirect", destination: tenantContextDestination(identity, requestedTenant, continuation) };
}
