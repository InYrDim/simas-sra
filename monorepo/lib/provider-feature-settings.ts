export const PROVIDER_FEATURES = [
  {
    key: "masterDataRead",
    label: "Baca Data Master",
    description: "Mengizinkan Tenant membuka dan melihat halaman Data Master.",
  },
  {
    key: "masterDataWrite",
    label: "Kelola Data Master",
    description: "Mengizinkan School Admin menambah dan mengubah Data Master.",
  },
  {
    key: "masterDataImportDownload",
    label: "Unduh Template Impor",
    description: "Mengizinkan Tenant mengunduh template impor Data Master.",
  },
  {
    key: "masterDataImportValidation",
    label: "Validasi Impor",
    description: "Mengizinkan Tenant mengunggah dan memvalidasi berkas impor.",
  },
  {
    key: "masterDataImportExecution",
    label: "Eksekusi Impor",
    description: "Mengizinkan Tenant menerapkan hasil impor yang telah divalidasi.",
  },
  {
    key: "advancedAnalytics",
    label: "Analitik Lanjutan",
    description: "Menampilkan komponen analitik lanjutan pada dashboard Tenant.",
  },
] as const;

export type ProviderFeatureKey = (typeof PROVIDER_FEATURES)[number]["key"];
export type ProviderFeatureSelection = Record<ProviderFeatureKey, boolean>;

export function readProviderFeatureSelection(settings: unknown): ProviderFeatureSelection {
  const root = settings && typeof settings === "object"
    ? settings as Record<string, unknown>
    : {};
  const features = root.features && typeof root.features === "object"
    ? root.features as Record<string, unknown>
    : {};

  return Object.fromEntries(
    PROVIDER_FEATURES.map(({ key }) => [key, features[key] === true]),
  ) as ProviderFeatureSelection;
}

export function mergeProviderFeatureSelection(
  settings: unknown,
  selection: ProviderFeatureSelection,
): Record<string, unknown> {
  const root = settings && typeof settings === "object"
    ? { ...settings as Record<string, unknown> }
    : {};
  const existingFeatures = root.features && typeof root.features === "object"
    ? root.features as Record<string, unknown>
    : {};

  return {
    ...root,
    features: {
      ...existingFeatures,
      ...selection,
    },
  };
}
