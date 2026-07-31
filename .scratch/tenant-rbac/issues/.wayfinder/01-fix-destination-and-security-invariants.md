# Fix the Tenant RBAC destination and security invariants

Type: grilling
Status: resolved
Blocked by: none

## Question

What destination, security contexts, role semantics, administrative boundaries, and enforcement invariants define this Tenant RBAC effort?

## Answer

The destination is a decision-complete, implementation-ready specification for RBAC within Tenant workspaces. Provider authorization remains separate. Provider Admin exclusively creates, replaces, disables, and recovers School Admin accounts; School Admin manages roles and assignments only for non-School-Admin Tenant users.

RBAC is universal for active Tenants. An Akun Pengguna may hold multiple Role Tenant entries, whose permissions combine additively without deny rules. School Admin may create custom roles from a system-owned permission catalog but cannot invent permission types. Person profiles and application roles remain separate.

RBAC grants capabilities while contextual domain relationships constrain record scope. The server is authoritative, fails closed, and applies grant changes on the next request. Unauthorized features are hidden in UI, while direct navigation and operations receive a consistent access-denied response. The destination includes Tenant role/assignment UI, Provider School Admin lifecycle UI, audit history, migration, and validation.
