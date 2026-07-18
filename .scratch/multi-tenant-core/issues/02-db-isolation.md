Type: grilling
Status: resolved

## Question

Bagaimana arsitektur isolasi data antar tenant di database (mengingat sekolah mungkin membutuhkan fitur unik)?

## Answer

Menggunakan **Single Database with tenant_id**. Fitur unik akan ditangani menggunakan sistem **Feature Flags / Module Toggling** di dalam monorepo, serta kolom `JSONB` untuk field kustom. Kode tetap satu versi (SaaS murni).
