# 04 — Introduce the guarded Provider shell and real navigation routes

**What to build:** An authorized Provider Admin can navigate a distinct, responsive Provider area at `/provider/*`, while every nonfunctional destination remains a real guarded route with an informative empty state.

**Blocked by:** 01 — Separate Tenant navigation and adopt School Admin terminology; 03 — Provision and enforce Provider Admin access.

**Status:** ready-for-agent

- [ ] The `/provider` server layout checks Provider access before rendering a client shell and does not rely on the layout as the only security boundary.
- [ ] Provider navigation has separate Provider-only types, configuration, renderer, identity, and neutral theme with no Tenant navigation, role, configuration, or theme imports.
- [ ] Navigation is grouped as specified and every item links to its real `/provider/*` destination rather than a placeholder or catch-all.
- [ ] Root, subtree, detail-route, and query-string active states are correct and expose non-color semantics such as `aria-current`.
- [ ] Expanded, collapsed, and mobile modes preserve Provider identity, tooltips, accessible trigger state, keyboard behavior, focus handling, and drawer closing after navigation.
- [ ] Fitur, Billing, Impersonasi, Audit Log, Support Ticket, and Pengaturan Provider each render an informative empty state without fake data, mutations, or premature domain schema.
