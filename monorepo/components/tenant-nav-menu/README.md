# Dokumentasi Navigasi Sidebar Tenant

Navigasi Tenant menggunakan komponen `TenantNavMenu` yang mendukung submenu,
pengelompokan, dan penyaringan tampilan berdasarkan role Tenant.

## Struktur data

Menu didefinisikan di `config.ts` sebagai `tenantMenuItems` dengan tipe
`TenantNavItem`:

```typescript
export type TenantNavItem = {
  title: string
  url?: string
  icon?: LucideIcon
  roles: TenantRoleMatcher[]
  group?: string
  items?: Omit<TenantNavItem, "icon" | "group">[]
}
```

`TenantRole` hanya mewakili role pengguna Tenant. Wildcard `"*"` tersedia
melalui `TenantRoleMatcher` untuk konfigurasi visibilitas menu dan bukan role
pengguna.

## Menambahkan menu

Menu tanpa `group` masuk ke seksi **Menu Utama**:

```typescript
{
  title: "Dasbor",
  icon: Home,
  url: "/dashboard",
  roles: ["school-admin", "staff", "guru"],
}
```

Menu dengan `items` dirender sebagai submenu. Jika tidak ada child yang cocok
dengan role pengguna, parent juga disembunyikan.

```typescript
{
  title: "Akademik",
  icon: BookOpen,
  roles: ["staff", "guru", "pimpinan"],
  items: [
    { title: "Jadwal Pelajaran", url: "/akademik/jadwal", roles: ["staff", "guru"] },
    { title: "Penilaian & Rapor", url: "/akademik/nilai", roles: ["guru", "pimpinan"] },
  ],
}
```

Gunakan `group` untuk membuat seksi bernama tanpa mengubah urutan item dalam
konfigurasi.

## Integrasi role

`role` untuk `TenantSidebar` pada akhirnya harus berasal dari sesi Tenant.
Penyaringan menu hanya mengendalikan visibilitas UI dan bukan pengganti guard
route, action, atau data-access layer.
