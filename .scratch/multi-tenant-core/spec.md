Status: ready-for-agent
Labels: to-spec

## Problem Statement

The user is building SIMAS (Sistem Informasi Manajemen Sekolah), a B2B SaaS application for schools. The provider (developer) needs to serve multiple schools from a single monorepo (Next.js) and a single database. Schools must be isolated from each other via subdomains or custom domains. Furthermore, new schools receive a 1-month trial. After this trial expires, the school's workspace must automatically transition to a "read-only" mode where users can view data but not mutate it, rather than being completely locked out. The architecture needs to handle this gracefully without sprawling into multiple separate databases or codebases.

## Solution

A multi-tenant architecture built within a Next.js App Router monorepo, utilizing:
1. **Routing**: Next.js Middleware to dynamically rewrite URLs based on the incoming host (subdomain or custom domain) to specific Next.js folder routes (e.g., `app/(tenant)/[domain]/`).
2. **Data Isolation**: A Single Shared Database using MySQL and Drizzle ORM, where every tenant-specific table has a `tenant_id` column. Unique features per school are managed via feature flags and `JSONB` extension columns rather than separate schemas.
3. **Trial Enforcement**: A middleware and/or API-layer check that reads the tenant's subscription/trial status. If expired, all non-GET API requests (Server Actions, POST, PUT, DELETE, PATCH) are rejected, enforcing a global "Read-Only" mode.

## User Stories

1. As a SaaS Provider, I want a single codebase and database to maintain, so that I can easily deploy updates to all schools simultaneously.
2. As a School Administrator, I want to access my school's system via a custom subdomain (e.g., `sekolah-a.simas.com`), so that my users have a branded experience.
3. As a School Administrator, I want the option to use my own custom domain in the future, so that the system looks like our own internal software.
4. As a School Administrator, I want to sign up and immediately get a 1-month trial, so that I can evaluate the software without upfront payment.
5. As a School Administrator on an expired trial, I want to still be able to log in and view my dashboard and data, so that I don't lose access to historical information while I arrange payment.
6. As a School User on an expired trial, I want to see a clear indicator that the system is read-only, so that I understand why I cannot add or edit data.
7. As a SaaS Provider, I want the system to automatically block all data mutations for expired trials at the API level, so that I don't have to write custom UI logic for every single form to disable it.
8. As a School Administrator, I want to request unique data fields, so that the SaaS can accommodate my school's specific reporting needs without requiring a custom database.
9. As a SaaS Provider, I want to enable specific custom features for a single school via feature flags, so that I don't have to branch my codebase for custom clients.

## Implementation Decisions

- **Routing Mechanism**: We will use Next.js Middleware (`middleware.ts`) to read the `Host` header. If the host matches a tenant domain, the request is rewritten to a dynamic route like `/(tenant)/[domain]`. The provider's admin panel will be routed to a specific provider domain or path.
- **Database Schema**: A `tenant` table will be created containing `id`, `domain`, `trial_ends_at`, `status`, and `settings` (JSONB). All existing and future tenant-specific tables (e.g., `user`, `student`, `class`) must include a `tenantId` foreign key.
- **Trial / Read-Only Enforcement**: 
  - Next.js Middleware will inject a header (e.g., `x-tenant-readonly: true`) if the tenant's trial has expired.
  - Server Actions and API Routes will check this status (or use a wrapper function) and automatically throw a `403 Forbidden` or `Unauthorized` error for mutation attempts.
  - The UI will consume this state (e.g., via a React Context provider wrapping the layout) to visually disable forms or show banners.
- **Feature Flags**: The `tenant.settings` JSONB column will store feature toggles. A utility function `hasFeature(tenantId, featureName)` will dictate UI rendering and API logic for unique modules.

## Testing Decisions

- **What makes a good test**: Tests should verify external behavior—namely that tenant A cannot see or modify tenant B's data, and that a read-only tenant cannot perform mutations.
- **Modules to be tested**: 
  - The Next.js Middleware logic (using unit tests for domain extraction and rewrite rules).
  - Drizzle ORM application-level `tenant_id` scoping in query wrappers to prevent data leakage.
  - The Trial Expiration Server Action / API interceptor (integration tests verifying mutation requests return 403 on expired tenants).
- **Prior art**: The existing Next.js middleware patterns for multi-tenancy (e.g. Vercel Platforms starter).

## Out of Scope

- Integrating a payment gateway (e.g., Stripe, Midtrans) to actually upgrade the trial. This spec only covers the logical enforcement of the state.
- Designing the UI/UX of the provider admin dashboard.
- The actual business logic of the school (e.g., grades, attendance, scheduling).

## Further Notes

- By establishing the `tenant_id` pattern early, all future developers must use a strict repository pattern or Drizzle query wrapper to ensure they never query the database without scoping to the current `tenant_id`.
