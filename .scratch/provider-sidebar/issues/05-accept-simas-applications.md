# 05 — Accept immutable Pengajuan SIMAS

**What to build:** A school can submit a Pengajuan SIMAS whose original school and contact information is normalized, validated, and retained immutably for Provider review.

**Blocked by:** 02 — Expand the schema for Provider and Tenant lifecycle data.

**Status:** ready-for-agent

- [x] Submission collects the specified school identity, education, address, contact, WhatsApp, and optional needs information without asking the school to select a subdomain.
- [x] NPSN, email, WhatsApp, and whitespace are normalized before canonical values are persisted.
- [x] A valid submission creates one pending Pengajuan SIMAS with no decision metadata, rejection reason, or Tenant relationship.
- [x] Invalid input cannot create a partial Pengajuan SIMAS.
- [x] Pending or rejected submissions sharing NPSN or email may coexist as history and resubmission; approval-time conflicts are not incorrectly enforced during submission.
- [x] Tests establish that original submitted fields cannot be edited through application commands after creation.
