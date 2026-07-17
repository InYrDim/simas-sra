# Map: Multi-Tenant Implementation

## Decisions-so-far
- [01-subdomain-routing-skeleton.md](file:///C:/Users/iyede/code/___sra___/simas/.scratch/multi-tenant-impl/issues/01-subdomain-routing-skeleton.md): Set up `proxy.ts` to rewrite requests with subdomains to `/[domain]${path}` and added `app/(tenant)/[domain]/page.tsx` structure to render domain-specific content.
- [02-tenant-database-integration.md](file:///C:/Users/iyede/code/___sra___/simas/.scratch/multi-tenant-impl/issues/02-tenant-database-integration.md): Created `tenant` schema in Drizzle and populated with dummy data via a seed script. Connected the tenant page to query the database using the subdomain parameter to render the actual tenant name, or returned a 404 if the subdomain does not exist.
