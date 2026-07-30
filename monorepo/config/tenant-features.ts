export const TENANT_FEATURES = [
  {
    key: "masterData",
    label: "Data Master",
    description: "Fitur induk untuk seluruh akses dan operasi Data Master.",
  },
  {
    key: "masterDataRead",
    label: "Baca Data Master",
    description: "Mengizinkan Tenant membuka dan melihat halaman Data Master.",
    requires: ["masterData"],
  },
  {
    key: "masterDataWrite",
    label: "Kelola Data Master",
    description: "Mengizinkan School Admin menambah dan mengubah Data Master.",
    requires: ["masterData", "masterDataRead"],
  },
  {
    key: "masterDataImportDownload",
    label: "Unduh Template Impor",
    description: "Mengizinkan Tenant mengunduh template impor Data Master.",
    requires: ["masterData", "masterDataRead"],
  },
  {
    key: "masterDataImportValidation",
    label: "Validasi Impor",
    description: "Mengizinkan Tenant mengunggah dan memvalidasi berkas impor.",
    requires: ["masterData", "masterDataRead", "masterDataWrite"],
  },
  {
    key: "masterDataImportExecution",
    label: "Eksekusi Impor",
    description: "Mengizinkan Tenant menerapkan hasil impor yang telah divalidasi.",
    requires: ["masterData", "masterDataRead", "masterDataWrite", "masterDataImportValidation"],
  },
  {
    key: "advancedAnalytics",
    label: "Analitik Lanjutan",
    description: "Menampilkan komponen analitik lanjutan pada dashboard Tenant.",
  },
] as const;

export type TenantFeatureKey = (typeof TENANT_FEATURES)[number]["key"];
